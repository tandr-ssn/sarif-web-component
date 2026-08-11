import {Log} from 'sarif'
import {Viewer} from './Viewer'

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
