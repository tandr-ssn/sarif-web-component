import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {mount} from 'enzyme'
import * as React from 'react'
import {Result} from 'sarif'
import {AuditSummary} from './AuditSummary'

Enzyme.configure({adapter: new Adapter()})

function resultWithAudit(audit: object): Result {
	return {properties: {audit}} as unknown as Result
}

test('summarizes AuditScan risk metadata and keeps evidence in tooltips', () => {
	const result = resultWithAudit({
		status: 'review',
		classification: 'taint-unverified',
		confidence: 'MEDIUM',
		sink_family: 'filesystem-operation',
		resolution: 'interfile-taint',
		native_resolution: 'roslyn-semantic',
		native_reason: 'Caller input is unresolved',
		trace: {status: 'partial', scope: 'modeled-source-to-sink', reason: 'Caller origin is unresolved'},
		sink: {
			symbol: 'System.IO.File.Open',
			overload: 'System.IO.File.Open(string)',
			sensitive_parameter: 'path',
			selection: {status: 'confirmed', resolution: 'roslyn-symbol', reason: 'Resolved framework owner'},
			parameterization: {status: 'unresolved', resolution: 'not-applicable', reason: 'Not a SQL sink'},
		},
	})

	const wrapper = mount(<AuditSummary result={result} />)
	expect(wrapper.find('.swcAuditBadge').map(badge => badge.text())).toEqual([
		'Review',
		'Medium confidence',
		'Filesystem operation',
		'Partial trace',
	])
	expect(wrapper.find('.swcAuditBadge').at(0).prop('title')).toContain('Classification: Taint unverified')
	expect(wrapper.find('.swcAuditBadge').at(0).prop('title')).toContain('Reason: Caller input is unresolved')
	expect(wrapper.find('.swcAuditBadge').at(2).prop('title')).toContain('Sink: System.IO.File.Open')
	expect(wrapper.find('.swcAuditBadge').at(2).prop('title')).toContain('Parameterization: Unresolved')
	expect(wrapper.find('.swcAuditBadge').at(3).prop('title')).toContain('Caller origin is unresolved')
})

test('shows test-source evidence and dependency reachability when present', () => {
	const testResult = resultWithAudit({
		status: 'review',
		scope: 'test',
		test_source: {confidence: 'high', language: 'csharp', reasons: ['test-directory', 'test-attribute']},
	})
	const dependencyResult = resultWithAudit({
		classification: 'known-vulnerable-dependency',
		status: 'dependency-present',
		confidence: 'HIGH',
		reachability: 'unverified',
	})

	const testWrapper = mount(<AuditSummary result={testResult} />)
	expect(testWrapper.find('.swcAuditBadge').map(badge => badge.text())).toEqual(['Review', 'Test source'])
	expect(testWrapper.find('.swcAuditBadge').at(1).prop('title')).toContain('Evidence: Test directory, Test attribute')

	const dependencyWrapper = mount(<AuditSummary result={dependencyResult} />)
	expect(dependencyWrapper.find('.swcAuditBadge').map(badge => badge.text())).toEqual([
		'Dependency present',
		'High confidence',
		'Reachability unverified',
	])
})

test('does not render for ordinary SARIF or empty audit metadata', () => {
	expect(mount(<AuditSummary result={{} as Result} />).isEmptyRender()).toBe(true)
	expect(mount(<AuditSummary result={resultWithAudit({})} />).isEmptyRender()).toBe(true)
})
