// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './Viewer.scss'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { Component } from 'react'
import { computed, observable, autorun, IObservableValue, runInAction } from 'mobx'
import { observer } from 'mobx-react'
import { computedFn } from 'mobx-utils'
import { Log, Run } from 'sarif'

import './extension'

// Contexts must come before renderCell or anything the uses this.
export const FilterKeywordContext = React.createContext('')

import { FilterBar, MobxFilter, recommendedDefaultState } from './FilterBar'
import { RunCard } from './RunCard'
import { RunStore } from './RunStore'
const successPng = require('./Viewer.Success.png')
const noResultsPng = require('./Viewer.ZeroData.png')

import { Card } from 'azure-devops-ui/Card'
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard"
import { Page } from 'azure-devops-ui/Page'
import { SurfaceBackground, SurfaceContext } from 'azure-devops-ui/Surface'
import { IFilterState } from 'azure-devops-ui/Utilities/Filter'
import { ZeroData } from 'azure-devops-ui/ZeroData'
import { ObservableValue } from 'azure-devops-ui/Core/Observable'
import { Button } from 'azure-devops-ui/Button'
import { createLocalSourceFileReader, createSelectedFilesSourceFileReader, FileSystemDirectoryHandleLike, getCommonAbsoluteSourceRoot, getSourcePathFromRoot, getSourcePathFromSarifRoot } from './LocalSourceFile'
import { SourceFileReader, SourceFileReaderContext, SourceFileSelectionContext, SourcePathFormatterContext } from './SourceFile'
import {DEFAULT_RESULT_FIELDS, discoverResultFieldPaths} from './ResultFields'
import {ResultFieldSelector} from './ResultFieldSelector'
import {createResultCsv, createResultHtml, createResultHtmlTable, createResultMarkdown, createResultText, createResultTsv, downloadResultFile, ResultExportFormat, ResultExportScope} from './ResultExport'
import {ResultExportMenu} from './ResultExportMenu'
import {installTooltips} from './Tooltip'

export interface ViewerProps {
	logs?: Log[]

	/**
	 * Consider this the "initial" or "starting" state. This value is only applied once (during load).
	 */
	filterState?: IFilterState

	/**
	 * The state applied when the user resets. If omitted, the default is:
	 * ```javascript
	 * {
	 *     Baseline: { value: ['new', 'unchanged', 'updated'] },
	 *     Suppression: { value: ['unsuppressed'] },
	 * }
	 * ```
	 */
	defaultFilterState?: IFilterState

	user?: string
	hideBaseline?: boolean
	hideLevel?: boolean
	showSuppression?: boolean // If true, also defaults to Unsuppressed.
	showAge?: boolean // Enables age-related columns, group by age, and an age dropdown filter.
	showActions?: boolean

	/**
	 * Shows an offline source-folder picker. Locations in SARIF are resolved beneath the folder
	 * explicitly selected by the user; the viewer never receives its absolute operating-system path.
	 */
	showLocalSourcePicker?: boolean

	/**
	 * Optional host-provided source reader. It takes precedence over a folder selected by the built-in picker.
	 */
	sourceFileReader?: SourceFileReader

	/** Optional container where the local source picker is rendered instead of inside the viewer. */
	localSourcePickerContainer?: Element | null

	/** Optional session-storage prefix used to remember the selected source-folder name across reloads. */
	sessionStorageKey?: string

	/**
	 * Optional local-storage key used to remember the ordered Fields selection across browser restarts.
	 * A component-wide default is used when omitted; set this to false to disable persistence.
	 */
	fieldSelectionStorageKey?: string | false

	/**
	 * When there are zero errors¹, show this message instead of just "No Results".
	 * Intended to communicate definitive positive confidence since "No Results" may be interpreted as inconclusive.
	 * 
	 * Note¹: If the (starting) `filterState` shows...
	 * * Only errors (and hides warnings),
	 *   then success is only communicated when there are zero errors (even if there exists warnings).
	 * * Both errors and warnings,
	 *   then success is communicated only when there are zero errors *and* zero warnings.
	 * * Neither errors nor warnings,
	 *   then the behavior is undefined. The current implementation will never communicate success.
	 */
	successMessage?: string
}

@observer export class Viewer extends Component<ViewerProps> {
	private collapseComments = new ObservableValue(false)
	private filter: MobxFilter
	private groupByAge: IObservableValue<boolean>
	private selectedResultFields = observable.box<string[]>(DEFAULT_RESULT_FIELDS.slice())
	private pendingResultFields?: string[]
	private resultFieldSelectionRestored = false
	private resultFieldPersistence?: () => void
	private runCardKeys = new WeakMap<Run, number>()
	private nextRunCardKey = 0
	@observable.ref private sourceDirectory?: FileSystemDirectoryHandleLike
	@observable.ref private selectedSourceFiles?: File[]
	@observable private selectedSourceFolderName?: string
	@observable private rememberedSourceFolderName?: string
	@observable private sourceDirectoryError?: string
	private sourceDirectoryInput?: HTMLInputElement

	constructor(props) {
		super(props)
		const {defaultFilterState, filterState, showAge} = this.props
		this.filter = new MobxFilter(defaultFilterState, filterState)
		this.groupByAge = observable.box(showAge)
		if (this.props.sessionStorageKey) {
			try {
				this.rememberedSourceFolderName = window.sessionStorage.getItem(`${this.props.sessionStorageKey}:source-folder-name`) ?? undefined
			} catch (_) { }
		}
		const fieldStorageKey = this.getFieldSelectionStorageKey()
		if (fieldStorageKey) {
			try {
				const stored = JSON.parse(window.localStorage.getItem(fieldStorageKey) ?? 'null')
				if (Array.isArray(stored) && stored.every(field => typeof field === 'string')) this.pendingResultFields = stored
			} catch (_) { }
		}
		this.resultFieldPersistence = autorun(() => {
			const selected = this.selectedResultFields.get()
			if (!this.resultFieldSelectionRestored || !fieldStorageKey) return
			try {
				window.localStorage.setItem(fieldStorageKey, JSON.stringify(selected))
			} catch (_) { }
		})
		autorun(() => {
			const selected = this.selectedResultFields.get()
			Object.keys(this.filter.getState())
				.filter(key => key.startsWith('Column:') && !selected.includes(key.slice('Column:'.length)))
				.forEach(key => this.filter.resetFilterItemState(key))
		})
	}

	componentDidMount() {
		installTooltips(window)
		this.restoreResultFieldSelection()
	}

	componentDidUpdate(previousProps: ViewerProps) {
		if (previousProps.logs !== this.props.logs
			|| previousProps.showActions !== this.props.showActions
			|| previousProps.hideBaseline !== this.props.hideBaseline
			|| previousProps.showAge !== this.props.showAge) this.restoreResultFieldSelection()
	}

	componentWillUnmount() {
		this.resultFieldPersistence?.()
	}

	@observable warnOldVersion = false
	_warnOldVersion = autorun(() => {
		const {logs} = this.props
		this.warnOldVersion = logs?.some(log => log.version !== '2.1.0')
	})

	private runStores = computedFn(logs => {
		const {hideBaseline, showAge, showActions} = this.props
		if (!logs) return [] // Undef interpreted as loading.
		const runs = [].concat(...logs.filter(log => log.version === '2.1.0').map(log => { log.runs.forEach((run, index) => { run._index = index }); return log.runs })) as Run[]
		const {filter, groupByAge} = this
		const runStores = runs.map((run, i) => new RunStore(run, i, filter, groupByAge, hideBaseline, showAge, showActions, this.selectedResultFields))
		runStores.sort((a, b) => a.driverName.localeCompare(b.driverName)) // May not be required after introduction of runStoresSorted.
		return runStores
	}, { keepAlive: true })

	@computed get runStoresSorted() {
		const {logs} = this.props
		return this.runStores(logs).slice().sorted((a, b) => b.filteredCount - a.filteredCount) // Highest count first.
	}

	@computed private get resultFieldPaths(): string[] {
		const fields = DEFAULT_RESULT_FIELDS.slice()
		if (this.props.showActions) fields.push('Actions')
		if (!this.props.hideBaseline) fields.push('Baseline')
		if (this.props.showAge) fields.push('Rule', 'Age', 'First Observed')
		if (this.props.logs?.some(log => log.runs?.some(run => run.results?.some(result => result.workItemUris?.length)))) fields.push('Bug')
		return [...fields, ...discoverResultFieldPaths(this.props.logs)]
	}

	private getFieldSelectionStorageKey(): string | undefined {
		if (this.props.fieldSelectionStorageKey === false) return undefined
		return this.props.fieldSelectionStorageKey
			?? `${this.props.sessionStorageKey ?? '@microsoft/sarif-web-component'}:selected-result-fields`
	}

	private restoreResultFieldSelection() {
		if (this.props.logs === undefined) return
		const available = new Set(this.resultFieldPaths)
		const requested = this.pendingResultFields ?? this.selectedResultFields.get()
		const restored = Array.from(new Set(requested)).filter(field => available.has(field))
		const selection = restored.length ? restored : DEFAULT_RESULT_FIELDS.filter(field => available.has(field))
		this.pendingResultFields = undefined
		this.resultFieldSelectionRestored = true
		this.selectedResultFields.set(selection)
	}

	private getRunCardKey(run: Run): number {
		let key = this.runCardKeys.get(run)
		if (key === undefined) {
			key = this.nextRunCardKey++
			this.runCardKeys.set(run, key)
		}
		return key
	}

	private exportResults = (scope: ResultExportScope, format: ResultExportFormat) => {
		const output = {
			'csv-plain': () => ({content: createResultCsv(this.runStoresSorted, scope, 'plain'), extension: 'csv', type: 'text/csv;charset=utf-8'}),
			'csv-raw': () => ({content: createResultCsv(this.runStoresSorted, scope, 'raw'), extension: 'csv', type: 'text/csv;charset=utf-8'}),
			tsv: () => ({content: createResultTsv(this.runStoresSorted, scope), extension: 'tsv', type: 'text/tab-separated-values;charset=utf-8'}),
			html: () => ({content: createResultHtml(this.runStoresSorted, scope), extension: 'html', type: 'text/html;charset=utf-8'}),
			'html-table': () => ({content: createResultHtmlTable(this.runStoresSorted, scope), extension: 'html', type: 'text/html;charset=utf-8'}),
			text: () => ({content: createResultText(this.runStoresSorted, scope), extension: 'txt', type: 'text/plain;charset=utf-8'}),
			markdown: () => ({content: createResultMarkdown(this.runStoresSorted, scope), extension: 'md', type: 'text/markdown;charset=utf-8'}),
		}[format]()
		const {content, extension, type} = output
		const variant = format === 'html-table' ? '-table' : ''
		downloadResultFile(content, `sarif-findings-${scope}${variant}.${extension}`, type)
	}

	private selectSourceDirectory = async () => {
		if (!window.showDirectoryPicker) {
			this.sourceDirectoryInput?.click()
			return
		}
		try {
			const directory = await window.showDirectoryPicker({
				id: 'sarif-source-root',
				mode: 'read',
			})
			runInAction(() => {
				this.sourceDirectory = directory
				this.selectedSourceFiles = undefined
				this.selectedSourceFolderName = undefined
				this.rememberedSourceFolderName = directory.name
				this.sourceDirectoryError = undefined
			})
			this.rememberSourceFolderName(directory.name)
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return
			runInAction(() => this.sourceDirectoryError = error instanceof Error ? error.message : String(error))
		}
	}

	private selectSourceFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files ?? [])
		if (!files.length) return
		const firstPath = files[0].webkitRelativePath
		const folderName = firstPath ? firstPath.split('/')[0] : 'selected folder'
		runInAction(() => {
			this.sourceDirectory = undefined
			this.selectedSourceFiles = files
			this.selectedSourceFolderName = folderName
			this.rememberedSourceFolderName = folderName
			this.sourceDirectoryError = undefined
		})
		this.rememberSourceFolderName(folderName)
		// Allow choosing the same directory again after its contents change.
		event.target.value = ''
	}

	private rememberSourceFolderName(name: string) {
		if (!this.props.sessionStorageKey) return
		try {
			window.sessionStorage.setItem(`${this.props.sessionStorageKey}:source-folder-name`, name)
		} catch (_) { }
	}

	render() {
		const {hideBaseline, hideLevel, showSuppression, showAge, successMessage, showLocalSourcePicker, sourceFileReader, localSourcePickerContainer} = this.props
		const commonSourceRoot = getCommonAbsoluteSourceRoot(this.props.logs)
		const selectedSourceReader = this.sourceDirectory
			? createLocalSourceFileReader(this.sourceDirectory, commonSourceRoot)
			: this.selectedSourceFiles
				? createSelectedFilesSourceFileReader(this.selectedSourceFiles, commonSourceRoot)
				: undefined
		const effectiveSourceReader = sourceFileReader ?? selectedSourceReader
		const selectedSourceFolderName = this.sourceDirectory?.name ?? this.selectedSourceFolderName
		const sourcePathFormatter = (uri: string, run?: Run, artifactLocation?) => selectedSourceFolderName
			? getSourcePathFromRoot(uri, selectedSourceFolderName, commonSourceRoot)
			: run ? getSourcePathFromSarifRoot(uri, run, artifactLocation) : uri
		const sourceFolderDisplayName = selectedSourceFolderName ?? this.rememberedSourceFolderName
		const sourceFolderNeedsReconnect = !selectedSourceFolderName && !!this.rememberedSourceFolderName
		const compactSourcePicker = !!localSourcePickerContainer
		const sourceFolderTooltip = `${compactSourcePicker && commonSourceRoot
			? `Select the local folder corresponding to ${commonSourceRoot}. `
			: ''}Files from this folder are read locally in your browser. Nothing is uploaded or sent over the network.`
		const sourcePicker = showLocalSourcePicker && <div className={`swcLocalSourceBar${compactSourcePicker ? ' swcLocalSourceHeader' : ''}`}>
			<input
				type="file"
				multiple
				{...{ webkitdirectory: '' }}
				ref={input => this.sourceDirectoryInput = input ?? undefined}
				onChange={this.selectSourceFiles}
				style={{ display: 'none' }} />
			<span data-swc-tooltip={sourceFolderTooltip}>
				<Button
					text={selectedSourceFolderName ? 'Change source folder...' : sourceFolderNeedsReconnect ? 'Reconnect source folder...' : 'Choose source folder...'}
					onClick={this.selectSourceDirectory} />
			</span>
			{compactSourcePicker
				? sourceFolderDisplayName && <span>Sources root: <strong>{sourceFolderDisplayName}</strong>{sourceFolderNeedsReconnect && ' (reconnect required)'}</span>
				: <span>
					{sourceFolderDisplayName
						? <>Sources root: <strong>{sourceFolderDisplayName}</strong>{sourceFolderNeedsReconnect && ' (reconnect required)'}</>
						: commonSourceRoot
							? <>Choose the local folder corresponding to <code>{commonSourceRoot}</code>.</>
							: <>Choose the top-level folder containing the source files referenced by SARIF.</>}
				</span>}
			{this.sourceDirectoryError && <span className="swcLocalSourceError">{this.sourceDirectoryError}</span>}
		</div>
		const renderedSourcePicker = sourcePicker && (localSourcePickerContainer
			? ReactDOM.createPortal(sourcePicker, localSourcePickerContainer)
			: localSourcePickerContainer === null ? null : sourcePicker)

		// Computed values fail to cache if called from onRenderNearElement() for unknown reasons. Thus call them in advance.
		const currentfilterState = this.filter.getState()
		const allResultCount = this.runStoresSorted.reduce((total, runStore) => total + (runStore.run.results?.length ?? 0), 0)
		const filteredResultCount = this.runStoresSorted.reduce((total, runStore) => total + runStore.filteredResults.length, 0)
		const filterKeywords = currentfilterState.Keywords?.value
		const nearElement = (() => {
			const {runStoresSorted} = this
			if (!runStoresSorted.length) return null // Interpreted as loading.
			const filteredResultsCount = runStoresSorted.reduce((total, run) => total + run.filteredCount, 0)
			if (filteredResultsCount === 0) {

				const startingFilterState = this.props.filterState || recommendedDefaultState
				const startingFilterStateLevel: string[] = startingFilterState['Level']?.value ?? []
				if (!startingFilterStateLevel.length) {
					startingFilterStateLevel.push('error', 'warning', 'note', 'none') // Normalize.
				}

				const currentfilterStateLevel: string[] = currentfilterState['Level']?.value ?? []
				if (!currentfilterStateLevel.length) {
					currentfilterStateLevel.push('error', 'warning', 'note', 'none') // Normalize.
				}

				// Desired Behavior Matrix:
				// start curr 
				// ew    ew    success (common)
				// ew    e-    noResult (there could still be warnings)
				// ew    -w    noResult (there could still be errors)
				// ew    --    noResult (there could still be either)
				// e-    ew    success
				// e-    e-    success (common)
				// e-    -w    noResult (there could still be errors)
				// e-    --    noResult (there could still be either)
				// -w    ew    success (uncommon)
				// -w    e-    noResult (there could still be warnings, uncommon)
				// -w    -w    success (uncommon)
				// -w    --    noResult (there could still be either)
				// --    **    no scenario
				const showSuccess = successMessage
					&& (!startingFilterStateLevel.includes('error')   || currentfilterStateLevel.includes('error'))
					&& (!startingFilterStateLevel.includes('warning') || currentfilterStateLevel.includes('warning'))

				if (showSuccess && !filterKeywords) {
					return <div className="page-content-left page-content-right page-content-top">
						<Card contentProps={{ contentPadding: false }}>
							<ZeroData
								imagePath={successPng}
								imageAltText="Success"
								secondaryText={successMessage} />
						</Card>
					</div>
				}

				return <div className="page-content-left page-content-right page-content-top">
					<Card contentProps={{ contentPadding: false }}>
						<ZeroData
							imagePath={noResultsPng}
							imageAltText="No results found"
							secondaryText="No results found" />
					</Card>
				</div>
			}
			return runStoresSorted
				.filter(run => !filterKeywords || run.filteredCount)
				.map((run, index) => <div key={this.getRunCardKey(run.run)} className="page-content-left page-content-right page-content-top">
					<RunCard runStore={run} index={index} />
				</div>)
		})() as JSX.Element

		return <FilterKeywordContext.Provider value={filterKeywords ?? ''}>
			<SourceFileSelectionContext.Provider value={showLocalSourcePicker ? this.selectSourceDirectory : undefined}>
				<SourcePathFormatterContext.Provider value={sourcePathFormatter}>
					<SourceFileReaderContext.Provider value={effectiveSourceReader}>
						<SurfaceContext.Provider value={{ background: SurfaceBackground.neutral }}>
							<Page>
							<div className="swcShim"></div>
							{renderedSourcePicker}
							<FilterBar filter={this.filter} groupByAge={this.groupByAge.get()} hideBaseline={hideBaseline} hideLevel={hideLevel} showSuppression={showSuppression} showAge={showAge}
				resultFieldSelector={<ResultFieldSelector fieldPaths={this.resultFieldPaths} selected={this.selectedResultFields} />}
				resultExportMenu={<ResultExportMenu filteredCount={filteredResultCount} allCount={allResultCount}
					filtered={this.filter.hasChangesToReset()} onExport={this.exportResults} />} />
							{this.warnOldVersion && <MessageCard
								severity={MessageCardSeverity.Warning}
								onDismiss={() => this.warnOldVersion = false}>
								Pre-SARIF-2.1 logs have been omitted. Use the Artifacts explorer to access all files.
							</MessageCard>}
							{nearElement}
							</Page>
						</SurfaceContext.Provider>
					</SourceFileReaderContext.Provider>
				</SourcePathFormatterContext.Provider>
			</SourceFileSelectionContext.Provider>
		</FilterKeywordContext.Provider>
	}
}

export type { SourceFile, SourceFileReader } from './SourceFile'
