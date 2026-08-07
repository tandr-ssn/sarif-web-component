// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './RunCard.scss'
import * as React from 'react'
import {Component} from 'react'
import {autorun, runInAction, observable, computed, untracked} from 'mobx'
import {observer} from 'mobx-react'

import {Hi} from './Hi'
import {renderCell} from './RunCard.renderCell'
import {More, ResultOrRuleOrMore} from './Viewer.Types'
import {RunStore, SortRuleBy} from './RunStore'
import {TreeColumnSorting} from './RunCard.TreeColumnSorting'
import {tryOr} from './try'

import {Card} from 'azure-devops-ui/Card'
import {Observer} from 'azure-devops-ui/Observer'
import {ObservableValue, IObservableValue} from 'azure-devops-ui/Core/Observable'
import {IHeaderCommandBarItem} from 'azure-devops-ui/HeaderCommandBar'
import {MenuItemType} from 'azure-devops-ui/Menu'
import {Pill, PillSize} from "azure-devops-ui/Pill"
import {SortOrder} from 'azure-devops-ui/Table'
import {Tree, ITreeColumn} from 'azure-devops-ui/TreeEx'
import {TreeItemProvider, ITreeItemEx} from 'azure-devops-ui/Utilities/TreeItemProvider'
import {Tooltip} from 'azure-devops-ui/TooltipEx'
import {ResultColumnHeader} from './ResultColumnHeader'
import {copySelectedTableCells} from './TableClipboard'
import {getRunAuditSummary, RunAuditBadge, RunAuditDetails} from './RunAuditSummary'

@observer export class RunCard extends Component<{ runStore: RunStore, index: number, runCount: number }> {
	@observable private show = true
	private groupByMenuItems = [] as IHeaderCommandBarItem[]
	private itemProvider = new TreeItemProvider<ResultOrRuleOrMore>([])
	private columnCache = new Map<string, ITreeColumn<ResultOrRuleOrMore>>()

	@computed({ keepAlive: true }) private get sortRuleByMenuItems(): IHeaderCommandBarItem[] {
		const {runStore} = this.props
		const sortRuleBy = untracked(() => runStore.sortRuleBy)
		const onActivate = menuItem => {
			runStore.sortRuleBy = menuItem.data
			if (menuItem.data === SortRuleBy.Name) runStore.sortRuleOrder = SortOrder.ascending
			this.sortRuleByMenuItems.forEach(item => (item.checked as IObservableValue<boolean>).value = item.id === menuItem.id)
		}
		return [
			{
				data: SortRuleBy.Count,
				id: 'sortByRuleCount',
				text: 'Sort by rule count',
				ariaLabel: 'Sort by rule count',
				onActivate,
				important: false,
				checked: new ObservableValue(sortRuleBy === SortRuleBy.Count),
			},
			{
				data: SortRuleBy.Name,
				id: 'sortByRuleName',
				text: 'Sort by rule name',
				ariaLabel: 'Sort by rule name',
				onActivate,
				important: false,
				checked: new ObservableValue(sortRuleBy === SortRuleBy.Name),
			},
		]
	}

	@computed private get columns() {
		const {runStore} = this.props
		return runStore.columns.map((col, i) => {
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
						sortOrder: i === runStore.sortColumnIndex ? runStore.sortOrder : undefined
					},
				} as ITreeColumn<ResultOrRuleOrMore>)
			}
			const column = this.columnCache.get(id)
			column.name = name
			;(column as ITreeColumn<ResultOrRuleOrMore> & {copyString: typeof col.filterString}).copyString = col.copyString ?? col.filterString
			column.sortProps.sortOrder = i === runStore.sortColumnIndex ? runStore.sortOrder : undefined
			return column
		})
	}

	constructor(props) {
		super(props)
		const {runStore} = this.props

		if (runStore.showAge) {
			const onActivateGroupBy = menuItem => {
				runStore.groupByAge.set(menuItem.data)
				this.groupByMenuItems
					.filter(item => item.itemType !== MenuItemType.Divider)
					.forEach(item => (item.checked as IObservableValue<boolean>).value = item.id === menuItem.id)
			}
	
			this.groupByMenuItems = [
				{
					data: true,
					id: 'groupByAge',
					text: 'Group by age',
					ariaLabel: 'Group by age',
					onActivate: onActivateGroupBy,
					important: false,
					checked: new ObservableValue(runStore.groupByAge.get()),
				},
				{
					data: false,
					id: 'groupByRule',
					text: 'Group by rule',
					ariaLabel: 'Group by rule',
					onActivate: onActivateGroupBy,
					important: false,
					checked: new ObservableValue(!runStore.groupByAge.get()),
				},
				{ id: "separator", important: false, itemType: MenuItemType.Divider },
			]
		}

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
				const sortsRules = this.props.runStore.setColumnSort(columnIndex, proposedSortOrder)
				if (sortsRules) this.sortRuleByMenuItems.forEach(item =>
					(item.checked as IObservableValue<boolean>).value = item.id === 'sortByRuleName')
			})
		}
	)

	render() {
		const {show, itemProvider} = this
		const {runStore, runCount} = this.props
		
		return <Observer renderChildren={itemProvider}>
			{(observedProps: { itemProvider }) => {
				const qualityDomain = tryOr(() => runStore.run.tool.driver.properties['microsoft/qualityDomain'])
				const auditSummary = getRunAuditSummary(runStore.run)
				return <Card
					titleProps={{
						ariaLevel: 2,
						text: <Tooltip
							text={<>
								<div>{tryOr(
									() => runStore.run.tool.driver.fullName,
									() => `${runStore.run.tool.driver.name} ${runStore.run.tool.driver.semanticVersion || ''}`,
								)}</div>
								{tryOr(
									() => <div>{runStore.run.tool.driver.fullDescription.text}</div>,
									() => <div>{runStore.run.tool.driver.shortDescription.text}</div>,
								)}
								{auditSummary && <RunAuditDetails summary={auditSummary} />}
							</> as any}>
							<span className={'swcRunTitle'}>
								<Hi>{runStore.driverName}</Hi>{qualityDomain && ` (${qualityDomain})`}
								<Pill size={PillSize.compact}>{runStore.filteredCount}</Pill>
								{auditSummary && <RunAuditBadge summary={auditSummary} />}
							</span>{/* Tooltip marked as React.Children.only thus extra span. */}
						</Tooltip> as any
					}}
					contentProps={{ contentPadding: false }}
					headerCommandBarItems={[
						runCount > 1
							? {
								id: 'hide',
								text: '', // Remove?
								ariaLabel: 'Show/Hide',
								onActivate: () => this.show = !this.show,
								iconProps: { iconName: this.show ? 'ChevronDown' : 'ChevronUp' }, // Naturally updates as this entire object is re-created each render.
								important: runCount > 1
							}
							: undefined,
						...this.groupByMenuItems,
						...this.sortRuleByMenuItems,
					].filter(item => item)}
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
