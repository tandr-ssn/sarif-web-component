import {observable} from 'mobx'
import {Result, Run} from 'sarif'
import {MobxFilter} from './FilterBar'
import {RunStore, resultColumnFilterKey} from './RunStore'
import {isResultVariantGroup} from './ResultVariantGroup'

test('filters selected result columns by values and text', () => {
	const run = {
		tool: {driver: {name: 'Sample Tool'}},
		results: [
			{ruleId: 'R', kind: 'pass', message: {text: 'Allowed result'}},
			{ruleId: 'R', kind: 'fail', message: {text: 'Blocked result'}},
		],
	} as unknown as Run
	const filter = new MobxFilter({}, {})
	const selected = observable.box(['Kind'])
	const runStore = new RunStore(run, 0, filter, observable.box(false), true, false, false, selected)

	expect(runStore.columnFilterOptions('Kind')).toEqual(['fail', 'pass'])
	expect(runStore.filteredCount).toBe(2)
	filter.setFilterItemState(resultColumnFilterKey('Kind'), {value: ['pass']})
	expect(runStore.filteredCount).toBe(1)

	selected.set(['Details'])
	filter.setFilterItemState(resultColumnFilterKey('Details'), {value: 'blocked'})
	expect(runStore.filteredCount).toBe(1)
	expect((runStore.rulesFiltered[0].childItemsAll[0].data as Result).message.text).toBe('Blocked result')
})

test('filters public review variants before grouping them', () => {
	const results = ['Alpha interpretation', 'Beta interpretation'].map(text => ({
		ruleId: 'public.rule',
		message: {text},
		locations: [{physicalLocation: {
			artifactLocation: {uri: 'src/service.ts'},
			region: {startLine: 11, startColumn: 2, endLine: 11, endColumn: 8},
		}}],
		properties: {acah: {classification: 'public-rule-review'}},
	}))
	const run = {
		tool: {driver: {name: 'ACAH'}},
		properties: {acah: {formatVersion: 3}},
		results,
	} as unknown as Run
	const filter = new MobxFilter({}, {})
	const selected = observable.box(['Details'])
	const runStore = new RunStore(run, 0, filter, observable.box(false), true, false, false, selected)

	expect(isResultVariantGroup(runStore.rulesFiltered[0].childItemsAll[0].data)).toBe(true)
	filter.setFilterItemState(resultColumnFilterKey('Details'), {value: 'beta'})
	expect(runStore.filteredCount).toBe(1)
	expect(isResultVariantGroup(runStore.rulesFiltered[0].childItemsAll[0].data)).toBe(false)
	expect((runStore.filteredResults[0] as Result).message.text).toBe('Beta interpretation')
})
