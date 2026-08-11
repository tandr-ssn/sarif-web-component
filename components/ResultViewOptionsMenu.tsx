import './ResultViewOptionsMenu.scss'
import * as React from 'react'
import {observer} from 'mobx-react'
import {SortOrder} from 'azure-devops-ui/Table'
import {IMenuItem, MenuItemType, MoreButton} from 'azure-devops-ui/Menu'
import {RunStore, SortRuleBy} from './RunStore'

let menuId = 0

@observer export class ResultViewOptionsMenu extends React.Component<{runStores: RunStore[]}> {
	private readonly id = `swc-result-view-options-${menuId++}`

	private setGroupByAge = (value: boolean) => {
		this.props.runStores.forEach(store => store.groupByAge?.set(value))
	}

	private setSortRuleBy = (value: SortRuleBy) => {
		this.props.runStores.forEach(store => {
			store.sortRuleBy = value
			if (value === SortRuleBy.Name) store.sortRuleOrder = SortOrder.ascending
		})
	}

	render() {
		const {runStores} = this.props
		const showGroupChoices = runStores.some(store => store.showAge)
		const groupedByAge = showGroupChoices && runStores.every(store => store.groupByAge?.get())
		const allSortedBy = (value: SortRuleBy) => !!runStores.length
			&& runStores.every(store => store.sortRuleBy === value)
		const items: IMenuItem[] = [
			...(showGroupChoices ? [
				{id: 'groupByAge', text: 'Group by age', checked: groupedByAge, onActivate: () => this.setGroupByAge(true)},
				{id: 'groupByRule', text: 'Group by rule', checked: !groupedByAge, onActivate: () => this.setGroupByAge(false)},
				{id: 'groupDivider', itemType: MenuItemType.Divider},
			] : []),
			{id: 'sortByRuleCount', text: 'Sort by rule count', checked: allSortedBy(SortRuleBy.Count), onActivate: () => this.setSortRuleBy(SortRuleBy.Count)},
			{id: 'sortByRuleName', text: 'Sort by rule name', checked: allSortedBy(SortRuleBy.Name), onActivate: () => this.setSortRuleBy(SortRuleBy.Name)},
		]
		return <div className="swcResultViewOptions">
			<MoreButton ariaLabel="Result view options" disabled={!runStores.length}
				tooltipProps={{text: 'Result view options'}}
				contextualMenuProps={() => ({menuProps: {id: this.id, items}})} />
		</div>
	}
}
