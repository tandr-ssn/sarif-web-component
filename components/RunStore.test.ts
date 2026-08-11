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
import {createResultCsv} from './ResultExport'
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
	expect(runStore.displayColumns.map(column => column.id)).toEqual(['Details', 'Level', 'Kind'])
	expect(runStore.displayColumns[0].embedPath).toBe(true)
	expect(createResultCsv([runStore], 'all').split('\r\n')[0]).toBe('\ufeff"Path","Details","Level","Kind"')
})

it('keeps Path as a visible fallback when Details is not selected', () => {
	const run = {tool: {driver: {name: 'Sample Tool'}}, results: [{message: {text: 'Finding'}}]} as unknown as Run
	const selected = observable.box(['Path', 'Level'])
	const runStore = new RunStore(run, 0, new MobxFilter(), undefined, undefined, undefined, undefined, selected)
	expect(runStore.displayColumns.map(column => column.id)).toEqual(['Path', 'Level'])
})

it('exports built-in Path values relative to the SARIF source root', () => {
	const run = {
		tool: {driver: {name: 'River'}},
		versionControlProvenance: [{
			repositoryUri: 'https://example.test/calgary',
			mappedTo: {uri: 'file:///home/user/calgary/'},
		}],
		results: [{message: {text: 'Finding'}, locations: [{physicalLocation: {
			artifactLocation: {uri: 'file:///home/user/calgary/src/River.java'},
		}}]}],
	} as unknown as Run
	const selected = observable.box(['Path'])
	const runStore = new RunStore(run, 0, new MobxFilter(), undefined, undefined, undefined, undefined, selected)

	expect(runStore.columns[0].filterString(run.results[0])).toBe('calgary/src/River.java')
	expect(createResultCsv([runStore], 'all')).toBe('\ufeff"Path"\r\n"calgary/src/River.java"')
	expect(createResultCsv([runStore], 'all')).not.toContain('/home/user')
})

it('uses selected nested result fields as columns', () => {
	const selected = observable.box(['Path', 'result.properties.acah.sink.selection.status'])
	const run = {
		tool: {driver: {name: 'Sample Tool'}},
		properties: {acah: {formatVersion: 3}},
		results: [{message: {text: 'Finding'}, properties: {acah: {
			classification: 'taint-unverified', status: 'review', resolution: 'native', sink: {selection: {status: 'confirmed'}},
		}}}],
	} as unknown as Run
	const runStore = new RunStore(run, 0, new MobxFilter(), undefined, undefined, undefined, undefined, selected)

	expect(runStore.columns.map(column => column.id)).toEqual(['Path', 'result.properties.acah.sink.selection.status'])
	expect(runStore.columns[1].filterString(run.results[0])).toBe('confirmed')
})

it('uses associated rule fields as columns and exports their report values', () => {
	const selected = observable.box(['result.message.text', 'rule.shortDescription.text', 'rule.helpUri'])
	const run = {
		tool: {driver: {name: 'River', rules: [{
			id: 'CVE-2099-3000',
			shortDescription: {text: 'Affected dependency'},
			helpUri: 'https://example.test/CVE-2099-3000',
		}]}},
		results: [{ruleId: 'CVE-2099-3000', message: {text: 'Calgary.Package 1.0.0'}}],
	} as unknown as Run
	const runStore = new RunStore(run, 0, new MobxFilter(), undefined, undefined, undefined, undefined, selected)

	expect(runStore.columns.map(column => column.id)).toEqual(selected.get())
	expect(runStore.columns[1].filterString(run.results[0])).toBe('Affected dependency')
	expect(runStore.columns[2].filterString(run.results[0])).toBe('https://example.test/CVE-2099-3000')
	expect(createResultCsv([runStore], 'all')).toBe(
		'\ufeff"result.message.text","rule.shortDescription.text","rule.helpUri"\r\n' +
		'"Calgary.Package 1.0.0","Affected dependency","https://example.test/CVE-2099-3000"')
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

it('presents producer-confirmed cross-rule reviews once while preserving counts and exports', () => {
	const fingerprint = 'c'.repeat(64)
	const results = ['public.first', 'public.second'].map((ruleId, index) => ({
		ruleId,
		message: {text: `Interpretation ${index + 1}`},
		locations: [{physicalLocation: {
			artifactLocation: {uri: 'src/river.ts'},
			region: {startLine: 18, startColumn: 4, endLine: 18, endColumn: 20},
		}}],
		properties: {acah: {
			classification: 'public-taint-high-confidence',
			reviewGroup: {kind: 'equivalent-public-taint-site', memberCount: 2, ruleCount: 2, fingerprint},
		}},
	})) as unknown as Run['results']
	const run = {
		tool: {driver: {name: 'ACAH'}},
		properties: {acah: {formatVersion: 3}},
		results,
	} as unknown as Run
	const filter = {getState: () => ({})} as MobxFilter
	const runStore = new RunStore(run, 0, filter, observable.box(false))

	expect(runStore.rulesFiltered).toHaveLength(1)
	const group = runStore.rulesFiltered[0].childItemsAll[0]
	expect(isResultVariantGroup(group.data)).toBe(true)
	expect(group.childItemsAll).toHaveLength(2)
	expect(runStore.filteredCount).toBe(2)
	expect(runStore.filteredResults).toEqual(results)
})

it('handles multiple logs', () => {
	const viewer = new Viewer({})
	
})
