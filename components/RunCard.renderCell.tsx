// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './RunCard.renderCell.scss'
import * as React from 'react'
import {Fragment} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {Result} from 'sarif'

import {Hi} from './Hi'
import {tryOr, tryLink} from './try'
import {Rule, More, ResultOrRuleOrMore} from './Viewer.Types'
import {Snippet} from './Snippet'

import {css, Link, ObservableLike, Status, Statuses, StatusSize, PillSize, Pill,
	ISimpleTableCell, TableCell, ExpandableTreeCell, ITreeColumn, ITreeItemEx, ITreeItem, Icon, IconSize} from './AzureDevOpsUi'
import { renderPathCell } from './RunCard.renderPathCell'
import { renderActionsCell } from './RunCard.renderActionsCell'
import { getRepoUri } from './getRepoUri'
import { ExecutionTrace } from './ExecutionTrace'
import {getResultFieldValue, looksLikeMarkdown} from './ResultFields'
import {getResultSourceTrace} from './ResultSourceTrace'
import {AcahSummary} from './AcahSummary'
import {getRuleTooltip} from './RunCard.rowPresentation'
import {FindingTriage} from './FindingTriage'
import {FINDING_TRIAGE_COLUMN_ID, FindingTriageAction} from './FindingTriageAction'
import {safeLinkHref} from './SafeLink'

const colspan = 99 // No easy way to parameterize this, however extra does not hurt, so using an arbitrarily large value.

const visibleResultCount = (items: ITreeItem<ResultOrRuleOrMore>[] = []) => items.length

const itemResults = (items: ITreeItem<ResultOrRuleOrMore>[] = []) => items.map(item => item.data as Result)

type ResultTreeColumn<T> = ITreeColumn<T> & {
	copyString?: (result: Result) => string
	embedPath?: boolean
	embeddedPathCopyString?: (result: Result) => string
	findingTriage?: FindingTriage
}

const markdownRenderers = {
	link: ({href, children}) => {
		const safeHref = safeLinkHref(href)
		return safeHref ? <a href={safeHref} target="_blank" rel="noopener noreferrer">{children}</a> : <>{children}</>
	},
}

function renderResultFieldValue(fieldId: string, value: string): JSX.Element {
	const trimmed = value.trim()
	return looksLikeMarkdown(fieldId, trimmed)
		? <div className="swcResultFieldValue swcMarkDown">
			<ReactMarkdown source={trimmed} escapeHtml={true} plugins={[remarkGfm]} renderers={markdownRenderers} />
		</div>
		: <span className="swcResultFieldValue" style={{whiteSpace: 'pre-wrap'}}><Hi>{trimmed}</Hi></span>
}

export function renderCell<T extends ISimpleTableCell>(
	rowIndex: number,
	columnIndex: number,
	treeColumn: ITreeColumn<T>,
	treeItem: ITreeItemEx<T>): JSX.Element {

	const data = ObservableLike.getValue(treeItem.underlyingItem.data)
	const resultTreeColumn = treeColumn as ResultTreeColumn<T>
	const findingTriage = resultTreeColumn.findingTriage
	const commonProps = {
		className: treeColumn.className,
		columnIndex,
		treeItem,
		treeColumn,
	}
	if (treeColumn.id === FINDING_TRIAGE_COLUMN_ID) {
		return (data as any)?.message ? TableCell({
			children: <div className="swcFindingStickyAction">
				<FindingTriageAction triage={findingTriage} results={[data as unknown as Result]} compact />
			</div>,
			className: 'swcFindingStickyCell',
			columnIndex,
		}) : null
	}

	// ROW AGE
	const isAge = (item => item.isAge) as (item: any) => item is { name: string, treeItem: ITreeItem<ResultOrRuleOrMore> }
	if (isAge(data)) {
		const age = data
		return columnIndex === 0
			? ExpandableTreeCell({
				children: <div className="swcRowRule">{/* Div for flow layout. */}
					{age.name}
					<Pill size={PillSize.compact}>{visibleResultCount(age.treeItem.childItemsAll)}</Pill>
					<FindingTriageAction triage={findingTriage} results={itemResults(age.treeItem.childItemsAll)} />
				</div>,
				colspan,
				...commonProps,
			})
			: null
	}

	// ROW RULE
	const isRule = (item => item.isRule) as (item: any) => item is Rule
	if (isRule(data)) {
		const rule = data
		return columnIndex === 0
			? ExpandableTreeCell({
				children: <div className="swcRowRule">{/* Div for flow layout. */}
					<span className="swcRuleTitle" data-swc-tooltip={getRuleTooltip(rule)}>
						{tryLink(() => rule.helpUri, <Hi>{rule.id || rule.guid}</Hi>)}
						{tryOr(() => rule.name && <>: <Hi>{rule.name}</Hi></>)}
						{tryOr(() => rule.relationships.map((rel, i) => {
							const taxon = rule.run.taxonomies[rel.target.toolComponent.index].taxa[rel.target.index]
							return <Fragment key={rel.target.id}>{i > 0 ? ',' : ''} {tryLink(() => taxon.helpUri, taxon.name)}</Fragment>
						}))}
					</span>
					<Pill size={PillSize.compact}>{visibleResultCount(rule.treeItem.childItemsAll)}</Pill>
					<FindingTriageAction triage={findingTriage} results={itemResults(rule.treeItem.childItemsAll)} />
				</div>,
				colspan,
				...commonProps,
			})
			: null
	}

	// ROW RESULT
	const capitalize = (str: string) => str ? `${str[0].toUpperCase()}${str.slice(1)}` : str
	const isResult = (item => item.message !== undefined) as (item: any) => item is Result
	if (isResult(data)) {
		const result = data
		const rule = result._rule
		const resultColumn = resultTreeColumn
		const copyString = resultColumn.copyString
		const rawCopyValue = copyString?.(result) ?? ''
		const markdownCopyValue = looksLikeMarkdown(treeColumn.id, rawCopyValue)
			|| looksLikeMarkdown('value.text', rawCopyValue) ? rawCopyValue : undefined
		const embedPath = resultColumn.embedPath === true
		const copyMarker = <span hidden data-copy-value={rawCopyValue}
			data-copy-markdown-value={markdownCopyValue}
			data-copy-leading-value={embedPath ? resultColumn.embeddedPathCopyString?.(result) ?? '' : undefined}
			data-copy-always={treeColumn.id === 'Details' ? 'true' : undefined} />
		const status = {
			none: result.kind === 'pass' ? Statuses.Success : Statuses.Queued,
			note: Statuses.Information,
			error: Statuses.Failed,
		}[result.level] || Statuses.Warning
		const children = (() => {
			switch (treeColumn.id) {
				case 'Path':
					return renderPathCell(result)
				case 'Level':
					return <>
						<Status {...status} className="bolt-table-two-line-cell-icon flex-noshrink bolt-table-status-icon" size={StatusSize.m} ariaLabel={result.level || 'warning'} />
						<Hi>{capitalize(result.level ?? 'warning')}</Hi>
					</>
				case 'Kind':
					return <Hi>{capitalize(result.kind ?? 'fail')}</Hi>
						case 'Actions':
							return <> {renderActionsCell(result)} </>
						case 'Details':
							const messageFromRule = result._rule?.messageStrings?.[result.message.id ?? -1] ?? result.message;
							const formattedMessage = format(messageFromRule.text || result.message?.text, result.message.arguments) ?? '';
							const formattedMarkdown = format(messageFromRule.markdown || result.message?.markdown, result.message.arguments); // No '—', leave undefined if empty.
							return <div className="swcFindingDetails">
								{embedPath && renderPathCell(result, true)}
								<div className="swcFindingBody">
									{formattedMarkdown
										? <div className="swcMarkDown">
											<ReactMarkdown source={formattedMarkdown}
												escapeHtml={true} plugins={[remarkGfm]} renderers={markdownRenderers} />
										</div> // Div to cancel out containers display flex row.
										: <span style={{ whiteSpace: 'pre-line' }}><Hi>{renderMessageWithEmbeddedLinks(result, formattedMessage)}</Hi></span>}
									<AcahSummary result={result} />
									<Snippet ploc={result.locations?.[0]?.physicalLocation} run={result.run} trace={getResultSourceTrace(result)} />
									<ExecutionTrace result={result} />
								</div>
							</div>
						case 'Rule':
							return <>
								{tryLink(() => rule.helpUri, <Hi>{rule.id || rule.guid}</Hi>)}
								{tryOr(() => rule.name && <>: <Hi>{rule.name}</Hi></>)}
							</>
						case 'Baseline':
							return <Hi>{result.baselineState && capitalize(result.baselineState) || 'New'}</Hi>
						case 'Bug':
							return tryOr(() => {
								const href = safeLinkHref(result.workItemUris[0])
								if (!href) throw undefined
								return <Link href={href} target="_blank" rel="noopener noreferrer">
								<Icon iconName="LadybugSolid" size={IconSize.medium} style={{ color: '#E81123' }} />
								</Link>
							})
						case 'Age':
							return <Hi>{result.sla}</Hi>
						case 'First Observed':
							return <Hi>{result.firstDetection.toLocaleDateString()}</Hi>
				default:
					return renderResultFieldValue(treeColumn.id, getResultFieldValue(result, treeColumn.id))
			}
		})()
		const resultChildren = <div className="swcFindingWithTriage">
			<div className="swcFindingTriageContent">{copyMarker}{children}</div>
		</div>
		return columnIndex === 0
			? ExpandableTreeCell({children: resultChildren, ...commonProps})
			: TableCell({
				children: resultChildren,
				className: css(treeColumn.className, 'font-size'),
				columnIndex,
			})
	}

	// ROW MORE
	const isMore = (item => item.onClick !== undefined) as (item: any) => item is More
	if (isMore(data)) {
		return columnIndex === 0
			? ExpandableTreeCell({
				children: <Link onClick={data.onClick} tabIndex={-1}>Show all {data.count} findings</Link>,
				colspan,
				...commonProps
			})
			: null
	}

	return null
}

// Replace [text](relatedIndex) with <a href />
function renderMessageWithEmbeddedLinks(result: Result, message: string) {
	const rxLink = /\[([^\]]*)\]\(([^\)]+)\)/ // Matches [text](id). Similar to below, but with an extra grouping around the id part.
	return message.match(rxLink)
		? message
			.split(/(\[[^\]]*\]\([^\)]+\))/g)
			.map((item, i) => {
				if (i % 2 === 0) return item
				const [_, text, id] = item.match(rxLink)

				const href = (() => {
					if (isNaN(id as any)) return id // `id` is a URI string

					// Else `id` is a number
					// TODO: search other location collections
					// RelatedLocations is typically [{ id: 1, ...}, { id: 2, ...}]
					const physicalLocation = result.relatedLocations?.find(location => location.id === +id)?.physicalLocation
					return getRepoUri(physicalLocation?.artifactLocation?.uri, result.run, physicalLocation?.region)
				})()

				const safeHref = safeLinkHref(href)
				return safeHref
					? <a key={i} href={safeHref} target="_blank" rel="noopener noreferrer">{text}</a>
					: text
			})
		: message
}

// Borrowed from sarif-vscode-extension.
function format(template: string | undefined, args?: string[]) {
	if (!template) return undefined;
	if (!args) return template;
	return template.replace(/{(\d+)}/g, (_, group) => args[group]);
}
