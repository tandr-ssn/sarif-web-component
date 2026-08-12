import './ResultViewOptionsMenu.scss'
import * as React from 'react'
import {IObservableValue} from 'mobx'
import {observer} from 'mobx-react'
import {SortOrder, IMenuItem, MenuItemType, MoreButton} from './AzureDevOpsUi'
import {RunStore, SortRuleBy} from './RunStore'
import {Result} from 'sarif'
import {FindingTriage} from './FindingTriage'
import {ResultColumnLayout} from './ResultColumnLayout'

let menuId = 0

export interface ResultViewOptionsMenuProps {
	runStores: RunStore[]
	fitAllColumns: IObservableValue<boolean>
	columnLayout?: ResultColumnLayout
	findingTriage?: FindingTriage
	results?: Result[]
}

export function resultViewOptionItems(props: ResultViewOptionsMenuProps): IMenuItem[] {
	const {runStores, fitAllColumns, findingTriage, results = []} = props
	const fitAll = fitAllColumns.get()
	const showGroupChoices = runStores.some(store => store.showAge)
	const groupedByAge = showGroupChoices && runStores.every(store => store.groupByAge?.get())
	const allSortedBy = (value: SortRuleBy) => !!runStores.length
		&& runStores.every(store => store.sortRuleBy === value)
	const hiddenInCurrent = findingTriage?.hiddenCount(results) ?? 0
	const setGroupByAge = (value: boolean) => runStores.forEach(store => store.groupByAge?.set(value))
	const setSortRuleBy = (value: SortRuleBy) => runStores.forEach(store => {
			store.setRuleSort(value, value === SortRuleBy.Name ? SortOrder.ascending : store.sortRuleOrder)
		})
	const restoreCurrent = async () => {
		if (!findingTriage) return
		try { await findingTriage.setHidden(results, false) }
		catch (error) { window.alert(`Unable to restore findings: ${error instanceof Error ? error.message : error}`) }
	}
	const forgetAll = async () => {
		if (!findingTriage || !window.confirm('Forget all saved finding states in this browser? This cannot be undone.')) return
		try { await findingTriage.forgetAll() }
		catch (error) { window.alert(`Unable to forget saved finding states: ${error instanceof Error ? error.message : error}`) }
	}
	return [
		{id: 'fitAllColumns', text: 'Fit all columns', checked: fitAll,
			onActivate: () => props.columnLayout
				? props.columnLayout.setFitAll(!fitAll)
				: fitAllColumns.set(!fitAll)},
		{id: 'viewDivider', itemType: MenuItemType.Divider},
		...(showGroupChoices ? [
			{id: 'groupByAge', text: 'Group by age', checked: groupedByAge, onActivate: () => setGroupByAge(true)},
			{id: 'groupByRule', text: 'Group by rule', checked: !groupedByAge, onActivate: () => setGroupByAge(false)},
			{id: 'groupDivider', itemType: MenuItemType.Divider},
		] : []),
		{id: 'sortByRuleCount', text: 'Sort by rule count', checked: allSortedBy(SortRuleBy.Count), onActivate: () => setSortRuleBy(SortRuleBy.Count)},
		{id: 'sortByRuleName', text: 'Sort by rule name', checked: allSortedBy(SortRuleBy.Name), onActivate: () => setSortRuleBy(SortRuleBy.Name)},
		...(findingTriage ? [
			{id: 'triageDivider', itemType: MenuItemType.Divider},
			{id: 'restoreCurrentFindings', text: 'Restore all findings in this SARIF',
				disabled: !findingTriage.ready || findingTriage.pending || !hiddenInCurrent,
				onActivate: () => { void restoreCurrent() }},
			{id: 'forgetAllFindingStates', text: 'Forget all saved finding states…',
				disabled: !findingTriage.ready || findingTriage.pending || !findingTriage.hasStoredEntries,
				onActivate: () => { void forgetAll() }},
		] : []),
	]
}

@observer export class ResultViewOptionsMenu extends React.Component<ResultViewOptionsMenuProps> {
	private readonly id = `swc-result-view-options-${menuId++}`

	render() {
		const {runStores} = this.props
		const items = resultViewOptionItems(this.props)
		return <div className="swcResultViewOptions">
			<MoreButton ariaLabel="Result view options" disabled={!runStores.length}
				tooltipProps={{text: 'Result view options'}}
				contextualMenuProps={() => ({menuProps: {id: this.id, items}})} />
		</div>
	}
}
