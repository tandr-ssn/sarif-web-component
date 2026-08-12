import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {mount} from 'enzyme'
import * as React from 'react'
import {Run} from 'sarif'
import {getRunAcahSummary, RunAcahBadge} from './RunAcahSummary'

Enzyme.configure({adapter: new Adapter()})
const runWithAcah = (acah: object) => ({properties: {acah: {formatVersion: 4, ...acah}}} as unknown as Run)

test('summarizes v4 coverage, configuration, cache provenance, diagnostics, and filtering', () => {
	const summary = getRunAcahSummary(runWithAcah({
		nativeAnalysis: {csharp: {inputDetected: true, status: 'succeeded', version: '5.0'}, java: {inputDetected: false, status: 'no-input'}},
		workspaceDiagnostics: ['SDK selected', 'Workspace warning', 'Workspace warning'],
		semgrepCache: {status: 'hit', reused: true},
		registryRuleCache: {status: 'partial', mode: 'mixed', packs: [{status: 'live-fallback'}]},
		scanConfiguration: {excludedPaths: ['vendor/**'], excludedRuleIds: ['public.noisy'],
			sanitizers: {ids: ['safe_path']}, summaries: {ids: ['db_query']}},
		filteredParameterizedSqlFindings: [{ruleId: 'sql'}],
		filteredProcessStartInfoOverlaps: [{ruleId: 'process'}],
		filteredRedundantReviewCandidates: [{ruleId: 'review'}],
	}))
	expect(summary).toEqual({label: 'ACAH analysis incomplete · 2 diagnostics', lines: [
		'Format: ACAH SARIF v4', 'Native Csharp: Succeeded · version 5.0',
		'Semgrep evidence cache: Hit · reused',
		'Registry rule cache: Partial · Mixed mode · 1 live fallback',
		'Excluded paths: vendor/**', 'Excluded public rules: public.noisy',
		'Configured sanitizers: safe_path', 'Configured summaries: db_query',
		'Filtered evidence: 1 parameterized SQL, 1 process-start overlaps, 1 review duplicates',
		'Diagnostics: 2 (details retained in SARIF)',
	], incomplete: true})
	expect(mount(<RunAcahBadge summary={summary} />).text()).toContain('ACAH analysis incomplete')
})

test('marks partial native coverage as incomplete', () => {
	const summary = getRunAcahSummary(runWithAcah({nativeAnalysis: {java: {status: 'partial'}}}))
	expect(summary?.label).toBe('ACAH analysis incomplete')
	expect(summary?.incomplete).toBe(true)
})

test('shows v4 identity without optional analysis metadata', () => {
	expect(getRunAcahSummary(runWithAcah({}))).toEqual({label: 'ACAH v4', lines: ['Format: ACAH SARIF v4'], incomplete: false})
	expect(getRunAcahSummary({properties: {otherTool: {formatVersion: 4}}} as unknown as Run)).toBeUndefined()
})
