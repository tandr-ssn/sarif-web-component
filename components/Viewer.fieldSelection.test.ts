import {Log} from 'sarif'
import {Viewer} from './Viewer'
import {SortRuleBy} from './RunStore'
import {SortOrder} from 'azure-devops-ui/Table'

const logs = [{
	version: '2.1.0',
	runs: [{
		tool: {driver: {name: 'River', rules: [{id: 'river-rule', helpUri: 'https://example.test/advisory'}]}},
		results: [{ruleId: 'river-rule', message: {text: 'Affected Calgary.Package'}}],
	}],
}] as unknown as Log[]

test('restores available selected fields in order and persists later changes', () => {
	const storageKey = 'calgary-viewer:test-selected-result-fields'
	window.localStorage.setItem(storageKey, JSON.stringify([
		'rule.helpUri', 'missing.field', 'Path', 'rule.helpUri',
	]))
	const viewer = new Viewer({logs, fieldSelectionStorageKey: storageKey}) as any

	viewer.componentDidMount()
	expect(viewer.selectedResultFields.get()).toEqual(['rule.helpUri', 'Path'])

	viewer.selectedResultFields.set(['result.message.text', 'rule.helpUri'])
	expect(JSON.parse(window.localStorage.getItem(storageKey))).toEqual(['result.message.text', 'rule.helpUri'])
	viewer.componentWillUnmount()
	window.localStorage.removeItem(storageKey)
})

test('uses default fields when persisted field data is invalid', () => {
	const storageKey = 'river-viewer:test-invalid-result-fields'
	window.localStorage.setItem(storageKey, '{invalid')
	const viewer = new Viewer({logs, fieldSelectionStorageKey: storageKey}) as any

	viewer.componentDidMount()
	expect(viewer.selectedResultFields.get()).toEqual(['Path', 'Details', 'Level', 'Kind'])
	viewer.componentWillUnmount()
	window.localStorage.removeItem(storageKey)
})

test('restores and persists the fit-all-columns preference', () => {
	const storageKey = 'calgary-viewer:test-fit-all-columns'
	window.localStorage.setItem(storageKey, 'false')
	const viewer = new Viewer({logs, fitAllColumnsStorageKey: storageKey}) as any

	expect(viewer.fitAllColumns.get()).toBe(false)
	viewer.fitAllColumns.set(true)
	expect(window.localStorage.getItem(storageKey)).toBe('true')
	viewer.componentWillUnmount()
	window.localStorage.removeItem(storageKey)
})

test('restores and persists rule-group sorting', () => {
	const storageKey = 'calgary-viewer:test-rule-sort'
	window.localStorage.setItem(storageKey, JSON.stringify({by: 'name', order: 'descending'}))
	const viewer = new Viewer({logs, ruleSortStorageKey: storageKey}) as any

	expect(viewer.runStoresInOrder[0].sortRuleBy).toBe(SortRuleBy.Name)
	expect(viewer.runStoresInOrder[0].sortRuleOrder).toBe(SortOrder.descending)
	viewer.runStoresInOrder[0].setRuleSort(SortRuleBy.Count, SortOrder.ascending)
	expect(JSON.parse(window.localStorage.getItem(storageKey))).toEqual({by: 'count', order: 'ascending'})
	viewer.componentWillUnmount()

	const restored = new Viewer({logs, ruleSortStorageKey: storageKey}) as any
	expect(restored.runStoresInOrder[0].sortRuleBy).toBe(SortRuleBy.Count)
	expect(restored.runStoresInOrder[0].sortRuleOrder).toBe(SortOrder.ascending)
	restored.componentWillUnmount()
	window.localStorage.removeItem(storageKey)
})

test('preserves SARIF run order regardless of result counts or tool names', () => {
	const orderedLogs = [{
		version: '2.1.0',
		runs: [
			{tool: {driver: {name: 'Zinc'}}, results: [
				{ruleId: 'zinc-rule', message: {text: 'One result'}},
			]},
			{tool: {driver: {name: 'Athabasca'}}, results: [
				{ruleId: 'athabasca-rule', message: {text: 'First result'}},
				{ruleId: 'athabasca-rule', message: {text: 'Second result'}},
				{ruleId: 'athabasca-rule', message: {text: 'Third result'}},
			]},
			{tool: {driver: {name: 'Bow'}}, results: [
				{ruleId: 'bow-rule', message: {text: 'First result'}},
				{ruleId: 'bow-rule', message: {text: 'Second result'}},
			]},
		],
	}] as unknown as Log[]
	const viewer = new Viewer({logs: orderedLogs, fieldSelectionStorageKey: false, fitAllColumnsStorageKey: false}) as any

	expect(viewer.runStoresInOrder.map(store => store.driverName)).toEqual(['Zinc', 'Athabasca', 'Bow'])
	viewer.componentWillUnmount()
})

test('replaces and disposes run stores when behavior-changing props change', () => {
	const viewer = new Viewer({logs, showActions: false, fieldSelectionStorageKey: false, fitAllColumnsStorageKey: false}) as any
	const previousProps = viewer.props
	const firstStore = viewer.runStoresInOrder[0]
	const dispose = jest.spyOn(firstStore, 'dispose')

	viewer.props = {...previousProps, showActions: true}
	viewer.componentDidUpdate(previousProps)

	expect(dispose).toHaveBeenCalledTimes(1)
	expect(viewer.runStoresInOrder[0]).not.toBe(firstStore)
	viewer.componentWillUnmount()
})
