import './ResultViewOptionsMenu.scss'
import * as React from 'react'
import {IObservableValue} from 'mobx'
import {observer} from 'mobx-react'
import {SortOrder} from 'azure-devops-ui/Table'
import {IMenuItem, MenuItemType, MoreButton} from 'azure-devops-ui/Menu'
import {RunStore, SortRuleBy} from './RunStore'
import {Result} from 'sarif'
import {FindingTriage} from './FindingTriage'

let menuId = 0

@observer export class ResultViewOptionsMenu extends React.Component<{
	runStores: RunStore[]
	fitAllColumns: IObservableValue<boolean>
	findingTriage?: FindingTriage
	results?: Result[]
}> {
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

	private restoreCurrent = async () => {
		const {findingTriage, results = []} = this.props
		if (!findingTriage) return
		try { await findingTriage.setHidden(results, false) }
		catch (error) { window.alert(`Unable to restore findings: ${error instanceof Error ? error.message : error}`) }
	}

	private forgetAll = async () => {
		const {findingTriage} = this.props
		if (!findingTriage || !window.confirm('Forget all saved finding states in this browser? This cannot be undone.')) return
		try { await findingTriage.forgetAll() }
		catch (error) { window.alert(`Unable to forget saved finding states: ${error instanceof Error ? error.message : error}`) }
	}

	render() {
		const {runStores, fitAllColumns, findingTriage, results = []} = this.props
		const fitAll = fitAllColumns.get()
		const showGroupChoices = runStores.some(store => store.showAge)
		const groupedByAge = showGroupChoices && runStores.every(store => store.groupByAge?.get())
		const allSortedBy = (value: SortRuleBy) => !!runStores.length
			&& runStores.every(store => store.sortRuleBy === value)
		const hiddenInCurrent = findingTriage?.hiddenCount(results) ?? 0
		const items: IMenuItem[] = [
			{id: 'fitAllColumns', text: 'Fit all columns', checked: fitAll,
				onActivate: () => fitAllColumns.set(!fitAll)},
			{id: 'viewDivider', itemType: MenuItemType.Divider},
			...(showGroupChoices ? [
				{id: 'groupByAge', text: 'Group by age', checked: groupedByAge, onActivate: () => this.setGroupByAge(true)},
				{id: 'groupByRule', text: 'Group by rule', checked: !groupedByAge, onActivate: () => this.setGroupByAge(false)},
				{id: 'groupDivider', itemType: MenuItemType.Divider},
			] : []),
			{id: 'sortByRuleCount', text: 'Sort by rule count', checked: allSortedBy(SortRuleBy.Count), onActivate: () => this.setSortRuleBy(SortRuleBy.Count)},
			{id: 'sortByRuleName', text: 'Sort by rule name', checked: allSortedBy(SortRuleBy.Name), onActivate: () => this.setSortRuleBy(SortRuleBy.Name)},
			...(findingTriage ? [
				{id: 'triageDivider', itemType: MenuItemType.Divider},
				{id: 'restoreCurrentFindings', text: 'Restore all findings in this SARIF',
					disabled: !findingTriage.ready || findingTriage.pending || !hiddenInCurrent,
					onActivate: () => { void this.restoreCurrent() }},
				{id: 'forgetAllFindingStates', text: 'Forget all saved finding states…',
					disabled: !findingTriage.ready || findingTriage.pending || !findingTriage.hasStoredEntries,
					onActivate: () => { void this.forgetAll() }},
			] : []),
		]
		return <div className="swcResultViewOptions">
			<MoreButton ariaLabel="Result view options" disabled={!runStores.length}
				tooltipProps={{text: 'Result view options'}}
				contextualMenuProps={() => ({menuProps: {id: this.id, items}})} />
		</div>
	}
}
