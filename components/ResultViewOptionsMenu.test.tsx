import {observable} from 'mobx'
import {SortOrder} from 'azure-devops-ui/Table'
import {SortRuleBy} from './RunStore'
import {resultViewOptionItems} from './ResultViewOptionsMenu'

test('moves shared grouping and rule sorting choices into the result toolbar menu', () => {
	const groupByAge = observable.box(false)
	const fitAllColumns = observable.box(true)
	const stores = [
		{showAge: true, groupByAge, sortRuleBy: SortRuleBy.Count, sortRuleOrder: SortOrder.descending},
		{showAge: true, groupByAge, sortRuleBy: SortRuleBy.Count, sortRuleOrder: SortOrder.descending},
	] as any
	stores.forEach(store => store.setRuleSort = (by: SortRuleBy, order: SortOrder) => {
		store.sortRuleBy = by
		store.sortRuleOrder = order
	})
	let items = resultViewOptionItems({runStores: stores, fitAllColumns})

	expect(items.map(item => item.id)).toEqual([
		'fitAllColumns', 'viewDivider',
		'groupByAge', 'groupByRule', 'groupDivider', 'sortByRuleCount', 'sortByRuleName',
	])
	expect(items.find(item => item.id === 'fitAllColumns').checked).toBe(true)
	items.find(item => item.id === 'fitAllColumns').onActivate({} as any)
	expect(fitAllColumns.get()).toBe(false)
	expect(items.find(item => item.id === 'groupByRule').checked).toBe(true)
	items.find(item => item.id === 'groupByAge').onActivate({} as any)
	expect(groupByAge.get()).toBe(true)

	items.find(item => item.id === 'sortByRuleName').onActivate({} as any)
	expect(stores.map(store => store.sortRuleBy)).toEqual([SortRuleBy.Name, SortRuleBy.Name])
	expect(stores.map(store => store.sortRuleOrder)).toEqual([SortOrder.ascending, SortOrder.ascending])
	items = resultViewOptionItems({runStores: stores.slice(), fitAllColumns})
	expect(items.find(item => item.id === 'sortByRuleName').checked).toBe(true)
})

test('omits grouping choices when age grouping is unavailable', () => {
	const stores = [{showAge: false, groupByAge: observable.box(false), sortRuleBy: SortRuleBy.Count}] as any
	const items = resultViewOptionItems({runStores: stores, fitAllColumns: observable.box(true)})

	expect(items.map(item => item.id)).toEqual([
		'fitAllColumns', 'viewDivider', 'sortByRuleCount', 'sortByRuleName',
	])
})

test('offers current-file restore and confirmed global forgetting for saved triage state', async () => {
	const results = [{message: {text: 'River finding'}}] as any
	const findingTriage = {
		ready: true,
		pending: false,
		hasStoredEntries: true,
		hiddenCount: () => 1,
		setHidden: jest.fn().mockResolvedValue(undefined),
		forgetAll: jest.fn().mockResolvedValue(undefined),
	} as any
	const stores = [{showAge: false, groupByAge: observable.box(false), sortRuleBy: SortRuleBy.Count}] as any
	const items = resultViewOptionItems({runStores: stores, fitAllColumns: observable.box(true), findingTriage, results})

	expect(items.slice(-3).map(item => item.id)).toEqual([
		'triageDivider', 'restoreCurrentFindings', 'forgetAllFindingStates',
	])
	items.find(item => item.id === 'restoreCurrentFindings').onActivate({} as any)
	await Promise.resolve()
	expect(findingTriage.setHidden).toHaveBeenCalledWith(results, false)

	const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true)
	items.find(item => item.id === 'forgetAllFindingStates').onActivate({} as any)
	await Promise.resolve()
	expect(findingTriage.forgetAll).toHaveBeenCalled()
	confirm.mockRestore()
})
