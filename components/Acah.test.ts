import {ReportingDescriptor, Result, Run, ThreadFlowLocation} from 'sarif'
import {getResultAcah, getRunAcah, getTraceStepAcah, getTraceStepSymbol} from './Acah'

const v3Run = {properties: {acah: {formatVersion: 3}}} as unknown as Run

test('accepts only ACAH format v3', () => {
	expect(getRunAcah(v3Run)).toEqual({formatVersion: 3})
	expect(getRunAcah({properties: {acah: {formatVersion: 2}}} as unknown as Run)).toBeUndefined()
	expect(getRunAcah({properties: {otherTool: {formatVersion: 3}}} as unknown as Run)).toBeUndefined()
})

test('merges rule defaults with authoritative result metadata', () => {
	const rule = {id: 'rule', properties: {acah: {classification: 'sink-inventory', confidence: 'LOW', sinkFamily: 'filesystem'}}} as ReportingDescriptor
	const result = {properties: {acah: {classification: 'taint-unverified', status: 'review', resolution: 'native'}}} as unknown as Result

	expect(getResultAcah(result, v3Run, rule)).toEqual({
		classification: 'taint-unverified',
		confidence: 'LOW',
		sinkFamily: 'filesystem',
		status: 'review',
		resolution: 'native',
	})
})

test('reads only v3 ACAH trace-step metadata', () => {
	const step = {properties: {acah: {role: 'boundary', symbol: 'file', resolution: 'javac-symbol'}}} as ThreadFlowLocation
	expect(getTraceStepAcah(step, v3Run)).toEqual({role: 'boundary', symbol: 'file', resolution: 'javac-symbol'})
	expect(getTraceStepSymbol(step, v3Run)).toBe('file')
	expect(getTraceStepAcah(step, {properties: {acah: {formatVersion: 4}}} as unknown as Run)).toBeUndefined()
})
