// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {Artifact, Result, Run} from 'sarif'
import {IObservableValue, autorun, computed, observable, IReactionDisposer} from 'mobx'
import {RepositoryDetails, ResultOrRuleOrMore, Rule} from './Viewer.Types'
import { getRepositoryDetailsFromRemoteUrl, isRepositoryDetailsComplete } from './getRepositoryDetailsFromRemoteUrl'

import {ITreeItem} from 'azure-devops-ui/Utilities/TreeItemProvider'
import {MobxFilter} from './FilterBar'
import {SortOrder} from 'azure-devops-ui/Table'
import { getRepoUri } from './getRepoUri'
import {tryOr} from './try'
import {DEFAULT_RESULT_FIELDS, getResultFieldDisplayNames, getResultFieldValue} from './ResultFields'
import {resultDetailsCopyText} from './ResultTraceText'
import {getSourcePathFromSarifRoot} from './LocalSourceFile'
import {getRunAcah} from './Acah'
import {FindingTriage} from './FindingTriage'

declare module 'sarif' {
    interface Run {
		_index: number,
		_augmented: boolean
		_rulesInUse: Map<string, Rule>
		_agesInUse: Map<string, {
			results: any[];
			treeItem: any;
			name: string;
			isAge: boolean;
		}>
	}
}

export enum SortRuleBy { Count, Name }

export const isMatch = (field: string, keywords: string[]) => !keywords.length || keywords.some(keyword => field.includes(keyword))
export const resultColumnFilterKey = (fieldId: string) => `Column:${fieldId}`

export class RunStore {
	driverName: string
	@observable sortRuleBy = SortRuleBy.Count
	@observable sortRuleOrder = SortOrder.ascending
	@observable sortColumnIndex = 1
	@observable sortOrder = SortOrder.ascending
	private truncationDisposer: IReactionDisposer

	constructor(readonly run: Run, readonly logIndex, readonly filter: MobxFilter, readonly groupByAge?: IObservableValue<boolean>, readonly hideBaseline?: boolean, readonly showAge?: boolean, readonly showActions?: boolean, readonly selectedFields: IObservableValue<string[]> = observable.box(DEFAULT_RESULT_FIELDS.slice()), readonly findingTriage?: FindingTriage) {
		const {driver} = run.tool
		const sarifDriverName = driver.fullName || driver.name
		const acahRunTitle = getRunAcah(run)?.runTitle
		this.driverName = run.properties && run.properties['logFileName']
			|| typeof acahRunTitle === 'string' && acahRunTitle
			|| sarifDriverName.replace(/^Microsoft.CodeAnalysis.Sarif.PatternMatcher$/, 'CredScan on Push')
		const buildId = run.properties ? run.properties['buildId'] : 0
		const artifactName = run.properties ? run.properties['artifactName'] : ''
		const filePath = run.properties ? run.properties['filePath'] : ''

		if (!run._augmented) {
			run._rulesInUse = new Map<string, Rule>()
			run._agesInUse = new Map([
				['Past SLA'  , { results: [], treeItem: null, name: 'Past SLA (31+ days)'     , isAge: true }],
				['Within SLA', { results: [], treeItem: null, name: 'Within SLA (0 - 30 days)', isAge: true }],
			])

			const rules = driver.rules || []
			const rulesListed = new Map<string, Rule>(rules.map(rule => [rule.id, rule] as any)) // Unable to express [[string, RuleEx]].
			
			let url: string
			let repoDetails: RepositoryDetails;
			try	{
				url = getRepoUri('-', run)
				repoDetails = getRepositoryDetailsFromRemoteUrl(url)
			}
			catch (TypeError) { }

			run.results?.forEach((result, resultIndex) => {
				// Collate by Rule
				const {ruleIndex} = result
				const ruleId = result.ruleId ?? '(No Rule)' // Ignores 3.5.4 Hierarchical strings.
				if (!run._rulesInUse.has(ruleId)) {
					// Need to generate rules for some like Microsoft.CodeAnalysis.Sarif.PatternMatcher.
					const rule = ruleIndex !== undefined && rules[ruleIndex] as Rule || rulesListed.get(ruleId) || { id: ruleId } as Rule
					rule.isRule = true
					rule.run = run // For taxa.
					run._rulesInUse.set(ruleId, rule)
				}

				const rule = run._rulesInUse.get(ruleId)

				// Try to build a 'Fix in VS Code' action
				if (isRepositoryDetailsComplete(repoDetails) && buildId && artifactName && filePath) {
					const parameters = new URLSearchParams({
						buildId: String(buildId),
						artifactName: String(artifactName),
						filePath: String(filePath),
						organization: repoDetails.organizationName,
						project: repoDetails.projectName,
						repoName: repoDetails.repositoryName,
						runIndex: String(run._index),
						resultIndex: String(resultIndex),
						source: '1esscans',
					})
					const fixInVsCodeAction = {
						text: 'Fix in VS Code',
						linkUrl: `https://waveanalysis.microsoft.com/vscode/import?${parameters}`,
						imageName: 'vscode',
						className: 'vscode-action'
					}

                    const fixInVsAction = {
						text: 'Fix in Visual Studio',
						linkUrl: `https://waveanalysis.microsoft.com/vs/import?${parameters}`,
						imageName: 'vs',
						className: 'vs-action'
					}

					result.actions = [
						fixInVsCodeAction,
                    	fixInVsAction
					]
				}

				rule.results = rule.results || []
				rule.results.push(result)

				// Collate by Age
				const firstDetection = result.provenance?.firstDetectionTimeUtc
				result.firstDetection = firstDetection ? new Date(firstDetection) : new Date()
				const age = (new Date().getTime() - result.firstDetection.getTime()) / (24 * 60 * 60 * 1000) // 1 day in milliseconds
				result.sla = age > 31 ? 'Past SLA' : 'Within SLA'
				run._agesInUse.get(result.sla).results.push(result)

				// Fill-in url from run.artifacts as needed.
				const artLoc = tryOr(() => result.locations[0].physicalLocation.artifactLocation)
				if (artLoc && artLoc.uri === undefined) {
					const art = tryOr<Artifact>(() => run.artifacts[artLoc.index])
					artLoc.uri = art.location?.uri
				}

				result.run = run // For result renderer to get to run.artifacts.
				result._rule = rule
			})
			run._augmented = true
		}

		this.truncationDisposer = autorun(() => {
			this.showAllRevision // Read.
			const rules = this.groupByAge.get() // Slice to satisfy ref rulesTruncated.
				? this.agesFiltered.slice()
				: this.rulesFiltered.slice()

			rules.forEach(ruleTreeItem => {
				const maxLength = 3
				ruleTreeItem.childItems = !ruleTreeItem.isShowAll && ruleTreeItem.childItemsAll.length > maxLength
					? [
						...ruleTreeItem.childItemsAll.slice(0, maxLength),
						{ data: { count: this.resultCount(ruleTreeItem.childItemsAll), onClick: () => {
							ruleTreeItem.isShowAll = true
							this.showAllRevision++
						}}}
					]
					: ruleTreeItem.childItemsAll
			})

			this.rulesTruncated = rules
		}, { name: 'Truncation' })
	}

	dispose() {
		this.truncationDisposer?.()
	}

	private filterHelper(treeItems: ITreeItem<ResultOrRuleOrMore>[]) {
		const filter = this.filter.getState()
		const filterKeywords = (filter.Keywords?.value ?? '').toLowerCase().split(/\s+/).filter(part => part)
		const {sortOrder} = this
		const columns = this.columns
		const sortColumnIndex = Math.min(this.sortColumnIndex, columns.length - 1)
		const filteredByTreeItem = new Map<ITreeItem<ResultOrRuleOrMore>, Result[]>()

		treeItems.forEach(treeItem => {
			// if (!treeItem.hasOwnProperty('isShowAll')) extendObservable(treeItem, { isShowAll: false })
			treeItem.isShowAll = false

			// Filtering logic: Show if 1) dropdowns match AND 2) any field matches text.
			const isDriverMatch = isMatch(this.driverName.toLowerCase(), filterKeywords)

			const resultContainer = treeItem.data as { results: Result[] }
			const filteredResults = resultContainer.results
				.filter(result => {
					const triageValues = filter.Triage?.value as string[] | undefined ?? ['visible']
					const triageValue = this.findingTriage?.isHidden(result) ? 'hidden' : 'visible'
					if (triageValues.length && !triageValues.includes(triageValue)) return false
					for (const column of columns) {
						const value = filter[resultColumnFilterKey(column.id)]?.value as string | string[] | undefined
						const field = column.filterString(result)
						if (typeof value === 'string' && value.trim() && !field.toLowerCase().includes(value.trim().toLowerCase())) return false
						if (Array.isArray(value) && value.length && !value.includes(field)) return false
					}
					const {_rule} = result
					const ruleId = _rule.id.toLowerCase()
					const ruleName = _rule.name?.toLowerCase() ?? ''
					const isRuleMatch = isMatch(ruleId, filterKeywords) || isMatch(ruleName, filterKeywords)

					for (const columnName in filter) {
						if (columnName.startsWith('Column:')) continue
						if (columnName === 'Triage') continue
						if (columnName === 'Discussion') continue // Discussion filter does not apply to Results.
						const selectedValues = filter[columnName].value
						if (!Array.isArray(selectedValues)) continue
						if (!selectedValues.length) continue
						const map = {
							Baseline: (result: Result) => result.baselineState as string || 'new', // TODO: Merge with column def.
							Level: (result: Result) => result.level || 'warning',
							Suppression: (result: Result) => result.suppressions?.some(s => s.status === undefined || s.status === 'accepted') ? 'suppressed' : 'unsuppressed',
							Age: (result: Result) => result.sla.toLowerCase(),
						}
						const translatedCellValue = map[columnName] ? map[columnName](result) : result
						if (!selectedValues.includes(translatedCellValue)) return false
					}

					const isKeywordMatch = columns.some(column => {
						const field = column.filterString(result).toLowerCase()
						return isMatch(field, filterKeywords)
					})

					return isDriverMatch || isRuleMatch || isKeywordMatch
				})

			filteredResults.sort((resultLeft, resultRight) => {
				const resultToValue = columns[sortColumnIndex].sortString
				const valueLeft = resultToValue(resultLeft)
				const valueRight = resultToValue(resultRight)

				const inverter = sortOrder === SortOrder.ascending ? 1 : -1
				return inverter * valueLeft.localeCompare(valueRight)
			})
			filteredByTreeItem.set(treeItem, filteredResults)
		})

		treeItems.forEach(treeItem => {
			const filteredResults = filteredByTreeItem.get(treeItem) ?? []
			treeItem.childItemsAll = filteredResults.map(result => ({data: result}))
		})

		const treeItemsVisible = treeItems.filter(rule => rule.childItemsAll.length)

		const groupName = (item: ITreeItem<ResultOrRuleOrMore>) => {
			const data = item.data as Rule & {name?: string}
			return data.id ?? data.name ?? ''
		}
		const compareNames = (a: ITreeItem<ResultOrRuleOrMore>, b: ITreeItem<ResultOrRuleOrMore>) =>
			groupName(a).localeCompare(groupName(b))
		const ruleOrder = this.sortRuleOrder === SortOrder.ascending ? 1 : -1
		treeItemsVisible.sort(this.sortRuleBy === SortRuleBy.Count
			? (a, b) => this.resultCount(b.childItemsAll) - this.resultCount(a.childItemsAll) || compareNames(a, b)
			: (a, b) => ruleOrder * compareNames(a, b)
		)
		
		treeItemsVisible.forEach((rule, i) => rule.expanded = i === 0)

		return treeItemsVisible
	}

	@computed get agesFiltered() {
		const treeItems = [...this.run._agesInUse.values()]
			.map(age => {
				const treeItem = age.treeItem = age.treeItem || {
					data: age,
					expanded: false,
				}
				return treeItem as ITreeItem<ResultOrRuleOrMore>
			})
		return this.filterHelper(treeItems)
	}

	@computed get rulesFiltered() {
		const treeItems = [...this.run._rulesInUse.values()]
			.map(rule => {
				const treeItem = rule.treeItem = rule.treeItem || {
					data: rule,
					expanded: false,
				}
				return treeItem as ITreeItem<ResultOrRuleOrMore>
			})
		return this.filterHelper(treeItems)
	}

	@computed get filteredCount() {
		return this.rulesFiltered.reduce((total, rule) => total + this.resultCount(rule.childItemsAll), 0)
	}

	@computed get filteredResults(): Result[] {
		return this.rulesFiltered.flatMap(rule => rule.childItemsAll.map(item => item.data as Result))
	}

	@computed get visibleResults(): Result[] {
		return (this.run.results ?? []).filter(result => !this.findingTriage?.isHidden(result))
	}

	resultCount(items: ITreeItem<ResultOrRuleOrMore>[] = []): number {
		return items.length
	}

	@observable showAllRevision = 0
	@observable.ref rulesTruncated = [] as ITreeItem<ResultOrRuleOrMore>[] // Technically ITreeItem<Rule>[], ref assuming immutable array.

	setColumnSort(columnIndex: number, sortOrder: SortOrder): boolean {
		this.sortColumnIndex = columnIndex
		this.sortOrder = sortOrder
		if (!['Rule', 'ruleId'].includes(this.columns[columnIndex]?.id)) return false
		this.sortRuleBy = SortRuleBy.Name
		this.sortRuleOrder = sortOrder
		return true
	}

	@computed get columns() {
		const artifactPath = (result: Result) => {
			const physicalLocation = result.locations?.[0]?.physicalLocation
			const artifactLocation = physicalLocation?.artifactLocation ?? result.analysisTarget
			const uri = artifactLocation?.uri
			if (!uri) return ''
			const path = getSourcePathFromSarifRoot(uri, this.run, artifactLocation)
			const line = physicalLocation?.region?.startLine
			const column = physicalLocation?.region?.startColumn
			return line ? `${path}:${line}${column ? `:${column}` : ''}` : path
		}
		const pathValue = (result: Result) => tryOr<string>(
			() => artifactPath(result),
			() => result.locations[0].logicalLocations[0].fullyQualifiedName,
			'',
		)
		const detailsValue = (result: Result) => {
			const message = result.message?.markdown ?? result.message?.text ?? ''
			const snippet = tryOr<string>(
				() => result.locations[0].physicalLocation.contextRegion.snippet.text,
				() => result.locations[0].physicalLocation.region.snippet.text,
				'')
			return [message, snippet].filter(Boolean).join('\n')
		}
		const ruleValue = (result: Result) => `${result._rule?.id || result._rule?.guid || ''} ${result._rule?.name ?? ''}`
		const definitions = {
			Path: {filterString: pathValue, sortString: pathValue, width: -3},
			Details: {filterString: detailsValue, copyString: resultDetailsCopyText, sortString: (result: Result) => result.message?.text ?? '', width: -5},
			Level: {filterString: (result: Result) => result.level ?? 'warning', sortString: (result: Result) => result.level ?? 'warning', width: -1},
			Kind: {filterString: (result: Result) => result.kind ?? 'fail', sortString: (result: Result) => result.kind ?? 'fail', width: -1},
			Rule: {filterString: ruleValue, sortString: ruleValue, width: -2},
			Actions: {filterString: () => '', sortString: () => '', width: -2},
			Baseline: {filterString: (result: Result) => result.baselineState ?? 'new', sortString: (result: Result) => result.baselineState ?? 'new', width: -1},
			Bug: {filterString: () => '', sortString: () => '', width: -1},
			Age: {filterString: (result: Result) => result.sla ?? '', sortString: (result: Result) => result.sla ?? '', width: -1},
			'First Observed': {filterString: (result: Result) => result.firstDetection?.toLocaleDateString() ?? '', sortString: (result: Result) => result.firstDetection?.getTime().toString() ?? '', width: -1},
		}
		const selectedFields = this.selectedFields.get()
		const displayNames = getResultFieldDisplayNames(selectedFields)
		return selectedFields.map(id => ({
			id,
			name: displayNames.get(id) ?? id,
			...(definitions[id] ?? {
				filterString: (result: Result) => getResultFieldValue(result, id),
				sortString: (result: Result) => getResultFieldValue(result, id),
				width: -2,
			}),
		}))
	}

	/** Columns rendered by the table. A selected Path is embedded in Details when both are present. */
	@computed get displayColumns() {
		const columns = this.columns
		const pathColumn = columns.find(column => column.id === 'Path')
		const embedPath = !!pathColumn
			&& columns.some(column => column.id === 'Details')
		return columns
			.filter(column => !embedPath || column.id !== 'Path')
			.map(column => column.id === 'Details'
				? {...column, embedPath, embeddedPathCopyString: pathColumn?.filterString}
				: column)
	}

	columnFilterOptions(id: string): string[] {
		const column = this.columns.find(candidate => candidate.id === id)
		if (!column) return []
		return Array.from(new Set((this.run.results ?? [])
			.map(result => column.filterString(result).trim())
			.filter(Boolean)))
			.sort((left, right) => left.localeCompare(right))
	}
}
