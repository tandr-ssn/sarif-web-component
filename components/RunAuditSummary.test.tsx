import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {mount} from 'enzyme'
import * as React from 'react'
import {Run} from 'sarif'
import {getRunAuditSummary, RunAuditBadge, RunAuditDetails} from './RunAuditSummary'

Enzyme.configure({adapter: new Adapter()})

function runWithAudit(auditscan: object): Run {
	return {properties: {auditscan}} as unknown as Run
}

test('summarizes successful native analysis without counting no-input languages', () => {
	const summary = getRunAuditSummary(runWithAudit({
		native_analysis: {
			csharp: {input_detected: true, status: 'succeeded'},
			java: {input_detected: false, status: 'no-input'},
		},
		workspace_diagnostics: ['SDK selected', 'Workspace warning', 'Workspace warning'],
	}))

	expect(summary).toEqual({
		label: 'Analysis succeeded · 2 diagnostics',
		lines: ['Native Csharp: Succeeded', 'Diagnostics: 2 (details retained in SARIF)'],
		incomplete: false,
	})
	expect(mount(<RunAuditBadge summary={summary} />).text()).toBe('Analysis succeeded · 2 diagnostics')
	expect(mount(<RunAuditDetails summary={summary} />).text()).toContain('Native Csharp: Succeeded')
})

test('marks failed analysis as incomplete and summarizes other AuditScan checks', () => {
	const summary = getRunAuditSummary(runWithAudit({
		native_analysis: {java: {input_detected: true, status: 'failed'}},
		dependency_analysis: {status: 'succeeded', reachability: 'not established'},
		public_rule_analysis: {status: 'succeeded', verification: 'unverified'},
		test_source_partition: {status: 'separated', moved_findings: 3},
	}))

	expect(summary).toEqual({
		label: 'Analysis incomplete',
		lines: [
			'Native Java: Failed',
			'Dependencies: Succeeded · reachability not established',
			'Public rules: Succeeded · verification unverified',
			'Test partition: Separated · 3 findings moved',
		],
		incomplete: true,
	})
	expect(mount(<RunAuditBadge summary={summary} />).find('.swcRunAuditIncomplete')).toHaveLength(1)
})

test('does not render a summary without recognized AuditScan analysis metadata', () => {
	expect(getRunAuditSummary({} as Run)).toBeUndefined()
	expect(getRunAuditSummary(runWithAudit({native_analysis: {go: {input_detected: false, status: 'no-input'}}}))).toBeUndefined()
})
