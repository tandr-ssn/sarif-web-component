// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './RunCard.scss'
import * as React from 'react'
import {Component} from 'react'
import {autorun, runInAction, observable, computed} from 'mobx'
import {observer} from 'mobx-react'

import {Hi} from './Hi'
import {renderCell} from './RunCard.renderCell'
import {More, ResultOrRuleOrMore} from './Viewer.Types'
import {RunStore} from './RunStore'
import {TreeColumnSorting} from './RunCard.TreeColumnSorting'
import {tryOr} from './try'

import {Card} from 'azure-devops-ui/Card'
import {Observer} from 'azure-devops-ui/Observer'
import {ObservableLike, ObservableValue} from 'azure-devops-ui/Core/Observable'
import {Pill, PillSize} from "azure-devops-ui/Pill"
import {SortOrder} from 'azure-devops-ui/Table'
import {Tree, ITreeColumn, ITreeRowDetails, renderTreeRow} from 'azure-devops-ui/TreeEx'
import {TreeItemProvider, ITreeItemEx} from 'azure-devops-ui/Utilities/TreeItemProvider'
import {ResultColumnHeader} from './ResultColumnHeader'
import {copySelectedTableCells} from './TableClipboard'
import {getRunAcahSummary, RunAcahBadge} from './RunAcahSummary'
import {getTreeRowClass} from './RunCard.rowPresentation'
import {RunTitle} from './RunTitle'

@observer export class RunCard extends Component<{ runStore: RunStore, index: number }> {
	@observable private show = true
	private itemProvider = new TreeItemProvider<ResultOrRuleOrMore>([])
	private columnCache = new Map<string, ITreeColumn<ResultOrRuleOrMore>>()

	@computed private get columns() {
		const {runStore} = this.props
		const sortedColumnId = runStore.columns[Math.min(runStore.sortColumnIndex, runStore.columns.length - 1)]?.id
		return runStore.displayColumns.map((col, i) => {
			const {id, name, width} = col
			if (!this.columnCache.has(id)) {
				const observableWidth = new ObservableValue(width)
				this.columnCache.set(id, {
					id,
					name,
					width: observableWidth,
					onSize: (e, i, newWidth) => observableWidth.value = newWidth,
					renderCell: renderCell, // Normally renderTreeCell
					renderHeaderCell: (columnIndex, column, focuszoneId, isFirstActionableHeader) =>
						<ResultColumnHeader columnIndex={columnIndex} column={column} runStore={runStore}
							focuszoneId={focuszoneId} isFirstActionableHeader={isFirstActionableHeader} />,
					sortProps: {
						ariaLabelAscending: "Sorted A to Z", // Need to change for date values.
						ariaLabelDescending: "Sorted Z to A",
						sortOrder: id === sortedColumnId ? runStore.sortOrder : undefined
					},
				} as ITreeColumn<ResultOrRuleOrMore>)
			}
			const column = this.columnCache.get(id)
			column.name = name
			;(column as ITreeColumn<ResultOrRuleOrMore> & {copyString: typeof col.filterString}).copyString = col.copyString ?? col.filterString
			;(column as ITreeColumn<ResultOrRuleOrMore> & {embedPath?: boolean}).embedPath = col.embedPath
			;(column as ITreeColumn<ResultOrRuleOrMore> & {embeddedPathCopyString?: typeof col.filterString}).embeddedPathCopyString = col.embeddedPathCopyString
			column.sortProps.sortOrder = id === sortedColumnId ? runStore.sortOrder : undefined
			return column
		})
	}

	constructor(props) {
		super(props)

		autorun(() => {
			this.itemProvider.clear()
			this.itemProvider.splice(undefined, undefined, [{ items: this.props.runStore.rulesTruncated }])
		})

		autorun(() => this.show = this.props.index === 0)
	}

	private sortingBehavior = new TreeColumnSorting<ITreeItemEx<ResultOrRuleOrMore>>(
		(columnIndex, proposedSortOrder, event) => {
			for (let index = 0; index < this.columns.length; index++) {
				const column = this.columns[index]
				if (column.sortProps) {
					column.sortProps.sortOrder = index === columnIndex ? proposedSortOrder : undefined
				}
			}
			runInAction(() => {
			const selectedColumnIndex = this.props.runStore.columns.findIndex(column => column.id === this.columns[columnIndex]?.id)
			this.props.runStore.setColumnSort(selectedColumnIndex, proposedSortOrder)
			})
		}
	)

	private renderRow = (rowIndex: number, item: ITreeItemEx<ResultOrRuleOrMore>, details: ITreeRowDetails<ResultOrRuleOrMore>) => {
		const data = ObservableLike.getValue(item.underlyingItem.data)
		return renderTreeRow(rowIndex, item, details, this.columns, data, getTreeRowClass(data))
	}

	private toggleShow = () => this.show = !this.show

	render() {
		const {show, itemProvider} = this
		const {runStore} = this.props
		
		return <Observer renderChildren={itemProvider}>
			{(observedProps: { itemProvider }) => {
				const qualityDomain = tryOr(() => runStore.run.tool.driver.properties['microsoft/qualityDomain'])
				const acahSummary = getRunAcahSummary(runStore.run)
				const runTitle = [
					tryOr(
						() => runStore.run.tool.driver.fullName,
						() => `${runStore.run.tool.driver.name} ${runStore.run.tool.driver.semanticVersion || ''}`.trim(),
					),
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
					{show && (itemProvider.length
						? <div onCopy={copySelectedTableCells}>
							<Tree<ResultOrRuleOrMore>
							className="swcTree"
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
							behaviors={[this.sortingBehavior]}
							renderRow={this.renderRow}
							selectableText={true}
							/>
						</div>
						: <div className="swcRunEmpty">No Results</div>
					)}
				</Card>
			}}
		</Observer>
	}
}
