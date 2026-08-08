import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {mount} from 'enzyme'
import * as React from 'react'
import {Run} from 'sarif'
import {getRunAcahSummary, RunAcahBadge} from './RunAcahSummary'

Enzyme.configure({adapter: new Adapter()})
const runWithAcah = (acah: object) => ({properties: {acah: {formatVersion: 3, ...acah}}} as unknown as Run)

test('summarizes native status, diagnostics, cache provenance, and filtering', () => {
	const summary = getRunAcahSummary(runWithAcah({
		nativeAnalysis: {csharp: {inputDetected: true, status: 'succeeded', version: '5.0'}, java: {inputDetected: false, status: 'no-input'}},
		workspaceDiagnostics: ['SDK selected', 'Workspace warning', 'Workspace warning'], semgrepCache: {status: 'hit', reused: true},
		filteredParameterizedSqlFindings: [{ruleId: 'sql'}],
	}))
	expect(summary).toEqual({label: 'ACAH analysis succeeded · 2 diagnostics', lines: [
		'Format: ACAH SARIF v3', 'Native Csharp: Succeeded · version 5.0',
		'Semgrep cache: Hit · evidence reused · provenance only', 'Filtered evidence: 1 parameterized SQL',
		'Diagnostics: 2 (details retained in SARIF)',
	], incomplete: false})
	expect(mount(<RunAcahBadge summary={summary} />).text()).toContain('ACAH analysis succeeded')
})

test('marks partial native coverage as incomplete', () => {
	const summary = getRunAcahSummary(runWithAcah({nativeAnalysis: {java: {status: 'partial'}}}))
	expect(summary?.label).toBe('ACAH analysis incomplete')
	expect(summary?.incomplete).toBe(true)
})

test('shows v3 identity without optional analysis metadata and rejects old metadata', () => {
	expect(getRunAcahSummary(runWithAcah({}))).toEqual({label: 'ACAH v3', lines: ['Format: ACAH SARIF v3'], incomplete: false})
	expect(getRunAcahSummary({properties: {auditscan: {format_version: 2}}} as unknown as Run)).toBeUndefined()
})
