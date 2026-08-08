import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {mount} from 'enzyme'
import * as React from 'react'
import {Result, Run} from 'sarif'
import {AcahSummary} from './AcahSummary'

Enzyme.configure({adapter: new Adapter()})

function resultWithAcah(acah: object, ruleAcah?: object): Result {
	const run = {properties: {acah: {formatVersion: 3}}} as unknown as Run
	return {run, _rule: {id: 'rule', properties: {acah: ruleAcah}}, properties: {acah}} as unknown as Result
}

test('summarizes ACAH v3 risk metadata and keeps evidence in tooltips', () => {
	const result = resultWithAcah({
		status: 'review', classification: 'taint-unverified', resolution: 'interfile-taint',
		nativeResolution: 'roslyn-semantic', nativeReason: 'Caller input is unresolved',
		trace: {status: 'partial', scope: 'modeled-source-to-sink', reason: 'Caller origin is unresolved'},
		sink: {symbol: 'System.IO.File.Open', sensitiveParameter: 'path',
			selection: {status: 'confirmed', resolution: 'roslyn-symbol', reason: 'Resolved framework owner'},
			parameterization: {status: 'unresolved', resolution: 'not-applicable', reason: 'Not a SQL sink'}},
	}, {confidence: 'MEDIUM', sinkFamily: 'filesystem-operation'})
	const wrapper = mount(<AcahSummary result={result} />)
	expect(wrapper.find('.swcAcahBadge').map(badge => badge.text())).toEqual([
		'Review', 'Medium confidence', 'Filesystem operation', 'Partial trace',
	])
	expect(wrapper.find('.swcAcahBadge').at(0).prop('data-swc-tooltip')).toContain('Classification: Taint unverified')
	expect(wrapper.find('.swcAcahBadge').at(2).prop('data-swc-tooltip')).toContain('Sensitive parameter: path')
	expect(wrapper.find('.swcAcahBadge').at(3).prop('data-swc-tooltip')).toContain('does not prove runtime reachability')
})

test('shows context without exposing value previews', () => {
	const result = resultWithAcah({classification: 'known-vulnerable-dependency', status: 'dependency-present', confidence: 'HIGH',
		resolution: 'osv-match', scope: 'test', testSource: {confidence: 'high', language: 'csharp', reasons: ['test-directory']},
		reachability: 'unverified', valuePreview: 'private source text'})
	const wrapper = mount(<AcahSummary result={result} />)
	expect(wrapper.text()).toContain('Test source')
	expect(wrapper.text()).toContain('Reachability unverified')
	expect(wrapper.html()).not.toContain('private source text')
})

test('does not render missing or unknown formats', () => {
	const missing = {run: {properties: {}}, properties: {otherTool: {status: 'review'}}} as unknown as Result
	const future = {run: {properties: {acah: {formatVersion: 4}}}, properties: {acah: {status: 'review'}}} as unknown as Result
	expect(mount(<AcahSummary result={missing} />).isEmptyRender()).toBe(true)
	expect(mount(<AcahSummary result={future} />).isEmptyRender()).toBe(true)
})
