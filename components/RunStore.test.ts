// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'react-dom'
jest.mock('react-dom')

import { Run } from 'sarif'
import { RunStore } from './RunStore'
import { Viewer } from './Viewer'

import { MobxFilter } from './FilterBar'
import {observable} from 'mobx'
import {SortOrder} from 'azure-devops-ui/Table'
import {isResultVariantGroup} from './ResultVariantGroup'
jest.mock('./FilterBar')

it('does not explode', () => { // Bare bones perf is 0.2s
	const run = {
		tool: { driver: { name: "Sample Tool" } },
		results: [{
			message: { text: 'Message 1' },
		}],
	} as unknown as Run

	const runStore = new RunStore(run, 0, new MobxFilter())
	expect(runStore.columns.map(column => column.id)).toEqual(['Path', 'Details', 'Level', 'Kind'])
})

it('uses selected nested result fields as columns', () => {
	const selected = observable.box(['Path', 'properties.acah.sink.selection.status'])
	const run = {
		tool: {driver: {name: 'Sample Tool'}},
		properties: {acah: {formatVersion: 3}},
		results: [{message: {text: 'Finding'}, properties: {acah: {
			classification: 'taint-unverified', status: 'review', resolution: 'native', sink: {selection: {status: 'confirmed'}},
		}}}],
	} as unknown as Run
	const runStore = new RunStore(run, 0, new MobxFilter(), undefined, undefined, undefined, undefined, selected)

	expect(runStore.columns.map(column => column.id)).toEqual(['Path', 'properties.acah.sink.selection.status'])
	expect(runStore.columns[1].filterString(run.results[0])).toBe('confirmed')
})

it('sorts rule groups by ruleId when that column is selected', () => {
	const selected = observable.box(['ruleId'])
	const run = {
		tool: {driver: {name: 'Semgrep'}},
		results: [
			{ruleId: 'rule-b', message: {text: 'B'}},
			{ruleId: 'rule-c', message: {text: 'C1'}},
			{ruleId: 'rule-a', message: {text: 'A'}},
			{ruleId: 'rule-c', message: {text: 'C2'}},
		],
	} as unknown as Run
	const filter = {getState: () => ({})} as MobxFilter
	const runStore = new RunStore(run, 0, filter, observable.box(false), false, false, false, selected)
	const ruleIds = () => runStore.rulesFiltered.map(item => (item.data as any).id)

	expect(ruleIds()).toEqual(['rule-c', 'rule-a', 'rule-b'])
	expect(runStore.setColumnSort(0, SortOrder.ascending)).toBe(true)
	expect(ruleIds()).toEqual(['rule-a', 'rule-b', 'rule-c'])
	runStore.setColumnSort(0, SortOrder.descending)
	expect(ruleIds()).toEqual(['rule-c', 'rule-b', 'rule-a'])
})

it('groups public review variants while preserving finding counts and exports', () => {
	const results = ['First interpretation', 'Second interpretation'].map(text => ({
		ruleId: 'public.rule',
		message: {text},
		locations: [{physicalLocation: {
			artifactLocation: {uri: 'src/service.ts'},
			region: {startLine: 14, startColumn: 3, endLine: 14, endColumn: 18},
		}}],
		properties: {acah: {classification: 'public-rule-review'}},
	})) as unknown as Run['results']
	const run = {
		tool: {driver: {name: 'ACAH'}},
		properties: {acah: {formatVersion: 3}},
		results,
	} as unknown as Run
	const filter = {getState: () => ({})} as MobxFilter
	const runStore = new RunStore(run, 0, filter, observable.box(false))

	const group = runStore.rulesFiltered[0].childItemsAll[0]
	expect(isResultVariantGroup(group.data)).toBe(true)
	expect(group.childItemsAll).toHaveLength(2)
	expect(runStore.filteredCount).toBe(2)
	expect(runStore.filteredResults).toEqual(results)
})

it('handles multiple logs', () => {
	const viewer = new Viewer({})
	
})
