import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {mount} from 'enzyme'
import * as React from 'react'
import {Result, Run} from 'sarif'
import {AcahSummary} from './AcahSummary'

Enzyme.configure({adapter: new Adapter()})

function resultWithAcah(acah: object, ruleAcah?: object): Result {
	const run = {properties: {acah: {formatVersion: 4}}} as unknown as Run
	return {run, _rule: {id: 'rule', properties: {acah: ruleAcah}}, properties: {acah}} as unknown as Result
}

test('summarizes an ACAH v4 claim, verdict, and detector provenance', () => {
	const claimId = 'a'.repeat(64)
	const result = resultWithAcah({
		status: 'plausible', classification: 'canonical-security-claim', resolution: 'acah-canonical-claim',
		claim: {id: claimId, vulnerabilityClass: 'cross-site-scripting', reason: 'Independent detectors disagree.', validationConflict: true},
		detectedBy: [
			{id: 'owned-observation', ruleId: 'acah.php.xss', message: 'Request reaches echo.', originalFingerprint: 'owned-fingerprint', codeFlowIndices: [0],
				producer: {id: 'acah-rules', title: 'ACAH rules'}, classification: 'taint-high-confidence', confidence: 'HIGH'},
			{id: 'public-observation', ruleId: 'public.php.xss', message: 'Unescaped output.', originalFingerprint: 'public-fingerprint', codeFlowIndices: [1, 2],
				producer: {id: 'public-registry', title: 'Public registry'}, classification: 'public-rule-review'},
		],
		effect: {status: 'unresolved', kind: 'raw-html-output', reason: 'The response endpoint was not resolved.'},
		nativeResolution: 'roslyn-semantic', nativeReason: 'Caller input is unresolved',
		trace: {status: 'partial', scope: 'modeled-source-to-sink', reason: 'Caller origin is unresolved'},
		sink: {symbol: 'System.IO.File.Open', sensitiveParameter: 'path',
			selection: {status: 'confirmed', resolution: 'roslyn-symbol', reason: 'Resolved framework owner'},
			parameterization: {status: 'unresolved', resolution: 'not-applicable', reason: 'Not a SQL sink'}},
	}, {confidence: 'MEDIUM', sinkFamily: 'filesystem-operation'})
	const wrapper = mount(<AcahSummary result={result} />)
	expect(wrapper.find('.swcAcahBadge').map(badge => badge.text())).toEqual([
		'Plausible', `Claim ${claimId.slice(0, 12)}`, 'Detected by 2', 'Medium confidence', 'Filesystem operation', 'Effect unresolved', 'Partial trace',
	])
	expect(wrapper.find('.swcAcahBadge').at(1).prop('data-swc-tooltip')).toContain(claimId)
	expect(wrapper.find('.swcAcahBadge').at(1).prop('data-swc-tooltip')).toContain('Validation conflict')
	expect(wrapper.find('.swcAcahBadge').at(2).prop('data-swc-tooltip')).toContain('Public registry — public.php.xss')
	expect(wrapper.find('.swcAcahBadge').at(2).prop('data-swc-tooltip')).toContain('Message: Unescaped output.')
	expect(wrapper.find('.swcAcahBadge').at(2).prop('data-swc-tooltip')).toContain('Code flows: 2, 3')
	expect(wrapper.find('.swcAcahBadge').at(4).prop('data-swc-tooltip')).toContain('Sensitive parameter: path')
	expect(wrapper.find('.swcAcahBadge').at(5).prop('data-swc-tooltip')).toContain('Effect state is independent')
	expect(wrapper.find('.swcAcahBadge').at(6).prop('data-swc-tooltip')).toContain('does not prove runtime reachability')
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
	const retired = {run: {properties: {acah: {formatVersion: 3}}}, properties: {acah: {status: 'review'}}} as unknown as Result
	expect(mount(<AcahSummary result={missing} />).isEmptyRender()).toBe(true)
	expect(mount(<AcahSummary result={retired} />).isEmptyRender()).toBe(true)
})
