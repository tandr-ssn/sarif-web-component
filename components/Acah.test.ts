import {ReportingDescriptor, Result, Run, ThreadFlowLocation} from 'sarif'
import {getResultAcah, getResultClaim, getResultDetectors, getRunAcah, getTraceStepAcah, getTraceStepSymbol} from './Acah'

const v4Run = {properties: {acah: {formatVersion: 4}}} as unknown as Run

test('accepts only ACAH format v4', () => {
	expect(getRunAcah(v4Run)).toEqual({formatVersion: 4})
	expect(getRunAcah({properties: {acah: {formatVersion: 3}}} as unknown as Run)).toBeUndefined()
	expect(getRunAcah({properties: {otherTool: {formatVersion: 4}}} as unknown as Run)).toBeUndefined()
})

test('merges rule defaults with authoritative result metadata', () => {
	const rule = {id: 'rule', properties: {acah: {classification: 'sink-inventory', confidence: 'LOW', sinkFamily: 'filesystem'}}} as ReportingDescriptor
	const result = {properties: {acah: {classification: 'taint-unverified', status: 'review', resolution: 'native'}}} as unknown as Result

	expect(getResultAcah(result, v4Run, rule)).toEqual({
		classification: 'taint-unverified',
		confidence: 'LOW',
		sinkFamily: 'filesystem',
		status: 'review',
		resolution: 'native',
	})
})

test('reads canonical claim and detector metadata', () => {
	const id = 'a'.repeat(64)
	const result = {run: v4Run, properties: {acah: {
		claim: {id, vulnerabilityClass: 'cross-site-scripting', reason: 'Exact request flow remains raw.'},
		detectedBy: [{ruleId: 'public.php.xss', producer: {id: 'public-registry', title: 'Public registry'}}],
	}}} as unknown as Result
	expect(getResultClaim(result)).toEqual({id, vulnerabilityClass: 'cross-site-scripting', reason: 'Exact request flow remains raw.'})
	expect(getResultDetectors(result)).toHaveLength(1)
})

test('reads only v4 ACAH trace-step metadata', () => {
	const step = {properties: {acah: {role: 'boundary', symbol: 'file', resolution: 'javac-symbol'}}} as ThreadFlowLocation
	expect(getTraceStepAcah(step, v4Run)).toEqual({role: 'boundary', symbol: 'file', resolution: 'javac-symbol'})
	expect(getTraceStepSymbol(step, v4Run)).toBe('file')
	expect(getTraceStepAcah(step, {properties: {acah: {formatVersion: 3}}} as unknown as Run)).toBeUndefined()
})
