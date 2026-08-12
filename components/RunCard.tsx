// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './RunCard.scss'
import * as React from 'react'
import {Component} from 'react'
import {autorun, observable, computed, IObservableValue, IReactionDisposer} from 'mobx'
import {observer} from 'mobx-react'

import {Hi} from './Hi'
import {renderCell} from './RunCard.renderCell'
import {More, ResultOrRuleOrMore} from './Viewer.Types'
import {RunStore} from './RunStore'
import {tryOr} from './try'

import {Card, Observer, ObservableLike, Pill, PillSize, Tree, ITreeColumn, ITreeRowDetails,
	renderTreeRow, TreeItemProvider, ITreeItemEx} from './AzureDevOpsUi'
import {copySelectedTableCells} from './TableClipboard'
import {getRunAcahSummary, RunAcahBadge} from './RunAcahSummary'
import {getTreeRowClass} from './RunCard.rowPresentation'
import {RunTitle} from './RunTitle'
import {ResultColumnLayout, ResultColumnScroll} from './ResultColumnLayout'

@observer export class RunCard extends Component<{
	runStore: RunStore
	index: number
	fitAllColumns?: IObservableValue<boolean>
	columnLayout?: ResultColumnLayout
}> {
	@observable private show = true
	private itemProvider = new TreeItemProvider<ResultOrRuleOrMore>([])
	private columnCache = new Map<string, ITreeColumn<ResultOrRuleOrMore>>()
	private columnLayout: ResultColumnLayout
	private disposers: IReactionDisposer[] = []

	@computed private get columns() {
		const {runStore} = this.props
		return runStore.displayColumns.map(col => {
			const {id, name, width} = col
			if (!this.columnCache.has(id)) {
				this.columnCache.set(id, {
					id,
					name,
					width: this.columnLayout.width(id, width),
					renderCell: renderCell, // Normally renderTreeCell
				} as ITreeColumn<ResultOrRuleOrMore>)
			}
			const column = this.columnCache.get(id)
			column.name = name
			column.width = this.columnLayout.width(id, width)
			;(column as ITreeColumn<ResultOrRuleOrMore> & {copyString: typeof col.filterString}).copyString = col.copyString ?? col.filterString
			;(column as ITreeColumn<ResultOrRuleOrMore> & {embedPath?: boolean}).embedPath = col.embedPath
			;(column as ITreeColumn<ResultOrRuleOrMore> & {embeddedPathCopyString?: typeof col.filterString}).embeddedPathCopyString = col.embeddedPathCopyString
			;(column as ITreeColumn<ResultOrRuleOrMore> & {findingTriage?: typeof runStore.findingTriage}).findingTriage = runStore.findingTriage
			return column
		})
	}

	constructor(props) {
		super(props)
		this.columnLayout = props.columnLayout ?? new ResultColumnLayout(props.fitAllColumns ?? observable.box(true))

		this.disposers.push(autorun(() => {
			this.itemProvider.clear()
			this.itemProvider.splice(undefined, undefined, [{ items: this.props.runStore.rulesTruncated }])
		}))

		this.disposers.push(autorun(() => this.show = this.props.index === 0))
	}

	componentWillUnmount() {
		this.disposers.forEach(dispose => dispose())
		this.disposers = []
	}

	private renderRow = (rowIndex: number, item: ITreeItemEx<ResultOrRuleOrMore>, details: ITreeRowDetails<ResultOrRuleOrMore>) => {
		const data = ObservableLike.getValue(item.underlyingItem.data)
		return renderTreeRow(rowIndex, item, details, this.columns, data, getTreeRowClass(data))
	}

	private toggleShow = () => this.show = !this.show

	render() {
		const {show, itemProvider} = this
		const {runStore} = this.props
		const fitAllColumns = this.columnLayout.fitAllColumns.get()
		
		return <Observer renderChildren={itemProvider}>
			{(observedProps: { itemProvider }) => {
				const qualityDomain = tryOr(() => runStore.run.tool.driver.properties['microsoft/qualityDomain'])
				const acahSummary = getRunAcahSummary(runStore.run)
				const runTitle = [
					runStore.driverName,
					tryOr(
						() => runStore.run.tool.driver.fullDescription.text,
						() => runStore.run.tool.driver.shortDescription.text,
					),
					...(acahSummary ? ['ACAH analysis', ...acahSummary.lines] : []),
				].filter(Boolean).join('\n')
				return <Card
					titleProps={{
						ariaLevel: 2,
						text: <RunTitle expanded={show} title={runTitle} onToggle={this.toggleShow}>
							<span className="swcRunTitle">
								<Hi>{runStore.driverName}</Hi>{qualityDomain && ` (${qualityDomain})`}
								<Pill size={PillSize.compact}>{runStore.filteredCount}</Pill>
								{acahSummary && <RunAcahBadge summary={acahSummary} />}
							</span>
						</RunTitle> as any
					}}
					contentProps={{ contentPadding: false }}
					className="flex-grow bolt-card-no-vertical-padding">
					{show && <div onCopy={copySelectedTableCells}>
						<ResultColumnScroll layout={this.columnLayout}>
							<Tree<ResultOrRuleOrMore>
							className="swcTree"
							containerClassName={fitAllColumns ? undefined : 'swcTreeHorizontalScroll'}
							columns={this.columns}
							itemProvider={itemProvider}
							onToggle={(event, treeItem: ITreeItemEx<ResultOrRuleOrMore>) => {
								itemProvider.toggle(treeItem.underlyingItem)
							}}
							onActivate={(event, treeRow) => {
								const treeItem = treeRow.data.underlyingItem
								const more = treeItem.data as More
								if (more.onClick) {
									more.onClick() // Handle "Show All"
								} else {
									itemProvider.toggle(treeItem)
								}
							}}
							renderRow={this.renderRow}
							selectableText={true}
							showHeader={false}
							showScroll={!fitAllColumns}
							/>
						</ResultColumnScroll>
						{!itemProvider.length && <div className="swcRunEmpty">
							{runStore.run.results?.length ? 'No matching results' : 'No Results'}
						</div>}
						</div>
					}
				</Card>
			}}
		</Observer>
	}
}
