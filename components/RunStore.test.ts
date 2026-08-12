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
import {createResultCsv, createResultHtmlTable} from './ResultExport'
import {RunCard} from './RunCard'
import {ResultColumnLayout} from './ResultColumnLayout'
import {FindingTriage, FindingTriageStore} from './FindingTriage'
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

it('uses the descriptive SARIF driver name in visible run headers', () => {
	const descriptiveRun = {
		tool: {driver: {name: 'ACAH', fullName: 'ACAH — Application findings'}},
		results: [],
	} as unknown as Run
	const overriddenRun = {
		tool: {driver: {name: 'ACAH', fullName: 'ACAH — Review candidates'}},
		properties: {logFileName: 'Imported review'},
		results: [],
	} as unknown as Run

	expect(new RunStore(descriptiveRun, 0, new MobxFilter()).driverName).toBe('ACAH — Application findings')
	expect(new RunStore(overriddenRun, 0, new MobxFilter()).driverName).toBe('Imported review')
})

it('prefers the authoritative ACAH section title', () => {
	const run = {
		tool: {driver: {name: 'ACAH', fullName: 'ACAH — Application findings'}},
		properties: {acah: {
			formatVersion: 4,
			section: {id: 'confirmed-findings', title: 'ACAH — Confirmed findings', order: 10},
			runTitle: 'ACAH — Confirmed findings',
		}},
		results: [],
	} as unknown as Run

	expect(new RunStore(run, 0, new MobxFilter()).driverName)
		.toBe('ACAH — Confirmed findings')
})

it('keeps Path as a visible fallback when Details is not selected', () => {
	const run = {tool: {driver: {name: 'Sample Tool'}}, results: [{message: {text: 'Finding'}}]} as unknown as Run
	const selected = observable.box(['Path', 'Level'])
	const runStore = new RunStore(run, 0, new MobxFilter(), undefined, undefined, undefined, undefined, selected)
	expect(runStore.displayColumns.map(column => column.id)).toEqual(['Path', 'Level'])
})

it('passes an embedded Path copy formatter to the rendered Details column', () => {
	const run = {
		tool: {driver: {name: 'River'}},
		results: [{message: {text: 'Finding'}, locations: [{physicalLocation: {
			artifactLocation: {uri: 'src/River.ts'},
			region: {startLine: 12, startColumn: 7},
		}}]}],
	} as unknown as Run
	const selected = observable.box(['Path', 'Details'])
	const runStore = new RunStore(run, 0, new MobxFilter(), undefined, undefined, undefined, undefined, selected)
	const runCard = new RunCard({runStore, index: 0})
	const detailsColumn = (runCard as any).columns[0]

	expect(detailsColumn.id).toBe('Details')
	expect(detailsColumn.embeddedPathCopyString(run.results[0])).toBe('src/River.ts:12:7')
})

it('switches between proportional fit widths and remembered scroll widths', () => {
	const run = {
		tool: {driver: {name: 'River'}},
		results: [{message: {text: 'Finding'}, locations: [{physicalLocation: {
			artifactLocation: {uri: 'src/River.ts'},
		}}]}],
	} as unknown as Run
	const selected = observable.box(['Path', 'Level'])
	const fitAllColumns = observable.box(true)
	const columnLayout = new ResultColumnLayout(fitAllColumns)
	const runStore = new RunStore(run, 0, new MobxFilter(), undefined, undefined, undefined, undefined, selected)
	const runCard = new RunCard({runStore, index: 0, columnLayout}) as any

	let columns = runCard.columns
	expect(columns.map(column => column.width.value)).toEqual([-3, -1])

	fitAllColumns.set(false)
	columns = runCard.columns
	expect(columns.map(column => column.width.value)).toEqual([300, 140])
	columnLayout.resize('Path', 360)

	fitAllColumns.set(true)
	expect(runCard.columns[0].width.value).toBe(-3)
	fitAllColumns.set(false)
	expect(runCard.columns[0].width.value).toBe(360)
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
			region: {startLine: 27, startColumn: 6},
		}}]}],
	} as unknown as Run
	const selected = observable.box(['Path'])
	const runStore = new RunStore(run, 0, new MobxFilter(), undefined, undefined, undefined, undefined, selected)

	expect(runStore.columns[0].filterString(run.results[0])).toBe('calgary/src/River.java:27:6')
	expect(createResultCsv([runStore], 'all')).toBe('\ufeff"Path"\r\n"calgary/src/River.java:27:6"')
	expect(createResultCsv([runStore], 'all')).not.toContain('/home/user')
	expect(createResultHtmlTable([runStore], 'all')).toContain('<td><pre>calgary/src/River.java:27:6</pre></td>')
	expect(createResultHtmlTable([runStore], 'all')).not.toContain('/home/user')
})

it('uses selected nested result fields as columns', () => {
	const selected = observable.box(['Path', 'result.properties.acah.sink.selection.status'])
	const run = {
		tool: {driver: {name: 'Sample Tool'}},
		properties: {acah: {formatVersion: 4}},
		results: [{message: {text: 'Finding'}, properties: {acah: {
			classification: 'taint-unverified', status: 'review', resolution: 'native', sink: {selection: {status: 'confirmed'}},
		}}}],
	} as unknown as Run
	const runStore = new RunStore(run, 0, new MobxFilter(), undefined, undefined, undefined, undefined, selected)

	expect(runStore.columns.map(column => column.id)).toEqual(['Path', 'result.properties.acah.sink.selection.status'])
	expect(runStore.columns[1].filterString(runStore.run.results[0])).toBe('confirmed')
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
	expect(runStore.columns[1].filterString(runStore.run.results[0])).toBe('Affected dependency')
	expect(runStore.columns[2].filterString(runStore.run.results[0])).toBe('https://example.test/CVE-2099-3000')
	expect(createResultCsv([runStore], 'all')).toBe(
		'\ufeff"Message Text","Short Description Text","Help Uri"\r\n' +
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

it('does not merge duplicate-looking v4 claims in the viewer', () => {
	const claimId = 'a'.repeat(64)
	const results = ['First interpretation', 'Second interpretation'].map(text => ({
		ruleId: 'public.rule',
		message: {text},
		locations: [{physicalLocation: {
			artifactLocation: {uri: 'src/service.ts'},
			region: {startLine: 14, startColumn: 3, endLine: 14, endColumn: 18},
		}}],
		partialFingerprints: {'acahClaim/v1': claimId},
		properties: {acah: {status: 'unknown', claim: {id: claimId, vulnerabilityClass: 'cross-site-scripting'}}},
	})) as unknown as Run['results']
	const run = {
		tool: {driver: {name: 'ACAH'}},
		properties: {acah: {formatVersion: 4}},
		results,
	} as unknown as Run
	const filter = {getState: () => ({})} as MobxFilter
	const runStore = new RunStore(run, 0, filter, observable.box(false))

	expect(runStore.rulesFiltered[0].childItemsAll).toHaveLength(2)
	expect(runStore.filteredCount).toBe(2)
	expect(runStore.filteredResults.map(result => result.message.text)).toEqual(results.map(result => result.message.text))
})

it('filters hidden findings persistently and excludes them from visible exports', async () => {
	const saved = new Set<string>()
	const store: FindingTriageStore = {
		load: async () => ({keys: [...saved], hasAny: !!saved.size}),
		setHidden: async (_namespace, keys, hidden) => keys.forEach(key => hidden ? saved.add(key) : saved.delete(key)),
		hasAny: async () => !!saved.size,
		clearAll: async () => saved.clear(),
	}
	const triage = new FindingTriage('river', store)
	await triage.load()
	const visibility = observable.box<string[]>(['visible'])
	const filter = {getState: () => ({Triage: {value: visibility.get()}})} as unknown as MobxFilter
	const run = {
		tool: {driver: {name: 'River'}},
		results: [
			{ruleId: 'RIVER001', fingerprints: {primary: 'a'}, message: {text: 'First finding'}},
			{ruleId: 'RIVER001', fingerprints: {primary: 'b'}, message: {text: 'Second finding'}},
		],
	} as unknown as Run
	const runStore = new RunStore(run, 0, filter, observable.box(false), false, false, false, undefined, triage)

	const viewResults = runStore.run.results
	await triage.setHidden([viewResults[0]], true)
	expect(runStore.visibleResults).toEqual([viewResults[1]])
	expect(runStore.filteredResults).toEqual([viewResults[1]])
	expect(createResultCsv([runStore], 'all')).not.toContain('First finding')

	visibility.set(['visible', 'hidden'])
	expect(runStore.filteredResults).toEqual(viewResults)
	visibility.set(['hidden'])
	expect(runStore.filteredResults).toEqual([viewResults[0]])
})

it('does not coalesce results from different rules', () => {
	const results = ['public.first', 'public.second'].map((ruleId, index) => ({
		ruleId,
		message: {text: `Interpretation ${index + 1}`},
		locations: [{physicalLocation: {
			artifactLocation: {uri: 'src/river.ts'},
			region: {startLine: 18, startColumn: 4, endLine: 18, endColumn: 20},
		}}],
		properties: {acah: {status: 'unknown'}},
	})) as unknown as Run['results']
	const run = {
		tool: {driver: {name: 'ACAH'}},
		properties: {acah: {formatVersion: 4}},
		results,
	} as unknown as Run
	const filter = {getState: () => ({})} as MobxFilter
	const runStore = new RunStore(run, 0, filter, observable.box(false))

	expect(runStore.rulesFiltered).toHaveLength(2)
	expect(runStore.rulesFiltered.every(group => group.childItemsAll.length === 1)).toBe(true)
	expect(runStore.filteredCount).toBe(2)
	expect(runStore.filteredResults.map(result => result.message.text)).toEqual(results.map(result => result.message.text))
})

it('does not add viewer metadata to the caller-owned SARIF run', () => {
	const run = {
		tool: {driver: {name: 'Calgary', rules: [{id: 'CAL001'}]}},
		artifacts: [{location: {uri: 'src/River.ts'}}],
		results: [{ruleId: 'CAL001', message: {text: 'Finding'}, locations: [{physicalLocation: {
			artifactLocation: {index: 0},
		}}]}],
	} as unknown as Run
	const before = JSON.stringify(run)

	const runStore = new RunStore(run, 0, new MobxFilter())

	expect(JSON.stringify(run)).toBe(before)
	expect(runStore.run).not.toBe(run)
	expect(runStore.run.results[0]).not.toBe(run.results[0])
	expect((run.results[0] as any).run).toBeUndefined()
	expect((run.results[0] as any)._rule).toBeUndefined()
	expect(run.results[0].locations[0].physicalLocation.artifactLocation.uri).toBeUndefined()
	expect(runStore.run.results[0].locations[0].physicalLocation.artifactLocation.uri).toBe('src/River.ts')
})

it('handles multiple logs', () => {
	const viewer = new Viewer({})
	
})
