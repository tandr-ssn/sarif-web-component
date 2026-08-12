// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {ReportingDescriptor, Result, Run, ThreadFlowLocation} from 'sarif'

export type AcahProperties = {[key: string]: any}
export type AcahTraceRole = 'source' | 'propagation' | 'sink' | 'boundary'
export type AcahVerdict = 'proven' | 'plausible' | 'unknown' | 'disproven'
export const ACAH_FORMAT_VERSION = 4

export interface AcahClaim {
	id: string
	vulnerabilityClass: string
	reason: string
	validationConflict?: boolean
}

export interface AcahDetector {
	id: string
	ruleId: string
	message: string
	classification: string
	originalFingerprint: string
	codeFlowIndices: number[]
	confidence?: string
	producer: {id: string; title: string}
}

export interface AcahEffect {
	status: 'unresolved' | 'modeled' | 'confirmed'
	kind: string
	reason: string
}

function object(value: unknown): AcahProperties | undefined {
	return value && typeof value === 'object' && !Array.isArray(value) ? value as AcahProperties : undefined
}

export function getRunAcah(run: Run | undefined): AcahProperties | undefined {
	const acah = object((run?.properties as any)?.acah)
	return acah?.formatVersion === ACAH_FORMAT_VERSION ? acah : undefined
}

export function getRuleAcah(rule: ReportingDescriptor | undefined, run: Run | undefined): AcahProperties | undefined {
	return getRunAcah(run) ? object((rule?.properties as any)?.acah) : undefined
}

/** Result metadata overrides rule defaults one field at a time. */
export function getResultAcah(
	result: Result,
	run: Run | undefined = result.run,
	rule: ReportingDescriptor | undefined = result._rule,
): AcahProperties | undefined {
	if (!getRunAcah(run)) return undefined
	const ruleAcah = getRuleAcah(rule, run)
	const resultAcah = object((result.properties as any)?.acah)
	if (!ruleAcah && !resultAcah) return undefined
	return {...ruleAcah, ...resultAcah}
}

export function getResultClaim(result: Result): AcahClaim | undefined {
	const claim = object(getResultAcah(result)?.claim)
	return typeof claim?.id === 'string' && /^[0-9a-f]{64}$/.test(claim.id)
		&& typeof claim.vulnerabilityClass === 'string' && !!claim.vulnerabilityClass
		&& typeof claim.reason === 'string' && !!claim.reason
		? claim as AcahClaim
		: undefined
}

export function getResultDetectors(result: Result): AcahDetector[] {
	const detectors = getResultAcah(result)?.detectedBy
	return Array.isArray(detectors)
		? detectors.filter(detector => {
			const item = object(detector)
			const producer = object(item?.producer)
			return !!item
				&& typeof item.id === 'string' && !!item.id
				&& typeof item.ruleId === 'string' && !!item.ruleId
				&& typeof item.message === 'string' && !!item.message
				&& typeof item.classification === 'string' && !!item.classification
				&& typeof item.originalFingerprint === 'string' && !!item.originalFingerprint
				&& Array.isArray(item.codeFlowIndices) && item.codeFlowIndices.every(index => Number.isInteger(index) && index >= 0)
				&& typeof producer?.id === 'string' && !!producer.id
				&& typeof producer.title === 'string' && !!producer.title
		}) as AcahDetector[]
		: []
}

export function getResultEffect(result: Result): AcahEffect | undefined {
	const effect = object(getResultAcah(result)?.effect)
	return ['unresolved', 'modeled', 'confirmed'].includes(effect?.status)
		&& typeof effect?.kind === 'string' && !!effect.kind
		&& typeof effect.reason === 'string' && !!effect.reason
		? effect as AcahEffect
		: undefined
}

export function getTraceStepAcah(step: ThreadFlowLocation | undefined, run: Run | undefined): AcahProperties | undefined {
	return getRunAcah(run) ? object((step?.properties as any)?.acah) : undefined
}

export function getTraceStepSymbol(step: ThreadFlowLocation | undefined, run: Run | undefined): string | undefined {
	const symbol = getTraceStepAcah(step, run)?.symbol
	return typeof symbol === 'string' && symbol ? symbol : undefined
}

export function getTraceStepRole(step: ThreadFlowLocation | undefined, run: Run | undefined): AcahTraceRole | undefined {
	const role = getTraceStepAcah(step, run)?.role
	return ['source', 'propagation', 'sink', 'boundary'].includes(role) ? role : undefined
}
