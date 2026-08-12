// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './AcahSummary.scss'
import * as React from 'react'
import {Result} from 'sarif'
import {AcahDetector, AcahProperties, getResultAcah, getResultClaim, getResultDetectors} from './Acah'

interface AcahBadge { label: string; title: string }

function text(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined
}

function readable(value: string): string {
	const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
	return words ? words[0].toUpperCase() + words.slice(1) : words
}

function detail(label: string, value: unknown): string | undefined {
	const item = text(value)
	return item ? `${label}: ${readable(item)}` : undefined
}

function title(lines: Array<string | undefined>): string {
	return lines.filter(Boolean).join('\n')
}

function statusBadge(acah: AcahProperties): AcahBadge | undefined {
	const status = text(acah.status) ?? text(acah.classification)
	if (!status) return undefined
	return {label: readable(status), title: title([
		detail('Status', acah.status), detail('Classification', acah.classification), detail('Resolution', acah.resolution),
		detail('Native analysis', acah.nativeResolution), text(acah.nativeReason) ? `Reason: ${acah.nativeReason}` : undefined,
	])}
}

function claimBadge(result: Result): AcahBadge | undefined {
	const claim = getResultClaim(result)
	if (!claim) return undefined
	return {
		label: `Claim ${claim.id.slice(0, 12)}`,
		title: title([
			`Stable claim ID: ${claim.id}`,
			detail('Vulnerability class', claim.vulnerabilityClass),
			text(claim.reason) ? `Verdict reason: ${claim.reason}` : undefined,
			claim.validationConflict ? 'Validation conflict: detectors disagree about this exact claim.' : undefined,
		]),
	}
}

function detectorLabel(detector: AcahDetector): string {
	return text(detector.producer?.title) ?? text(detector.producer?.id) ?? 'Unknown detector'
}

function detectorsBadge(result: Result): AcahBadge | undefined {
	const detectors = getResultDetectors(result)
	if (!detectors.length) return undefined
	return {
		label: `Detected by ${detectors.length}`,
		title: title([
			`This canonical claim combines ${detectors.length} detector${detectors.length === 1 ? '' : 's'}:`,
			...detectors.map(detector => {
				const rule = text(detector.ruleId)
				const classification = text(detector.classification)
				return `• ${detectorLabel(detector)}${rule ? ` — ${rule}` : ''}${classification ? ` (${readable(classification)})` : ''}`
			}),
		]),
	}
}

function confidenceBadge(acah: AcahProperties): AcahBadge | undefined {
	const confidence = text(acah.confidence)
	if (!confidence) return undefined
	const label = readable(confidence.toLowerCase())
	return {label: `${label} confidence`, title: `ACAH confidence: ${label}\nUse status and SARIF level/kind as the primary queue controls.`}
}

function sinkBadge(acah: AcahProperties): AcahBadge | undefined {
	const family = text(acah.sinkFamily)
	if (!family) return undefined
	const sink = acah.sink && typeof acah.sink === 'object' ? acah.sink : {}
	const selection = sink.selection && typeof sink.selection === 'object' ? sink.selection : {}
	const parameterization = sink.parameterization && typeof sink.parameterization === 'object' ? sink.parameterization : {}
	return {label: readable(family), title: title([
		`Sink family: ${readable(family)}`, text(sink.symbol) ? `Sink: ${sink.symbol}` : undefined,
		text(sink.overload) ? `Overload: ${sink.overload}` : undefined,
		text(sink.sensitiveParameter) ? `Sensitive parameter: ${sink.sensitiveParameter}` : undefined,
		detail('Selection', selection.status), detail('Selection resolution', selection.resolution),
		text(selection.reason) ? `Selection reason: ${selection.reason}` : undefined,
		detail('Parameterization', parameterization.status), detail('Parameterization resolution', parameterization.resolution),
		text(parameterization.reason) ? `Parameterization reason: ${parameterization.reason}` : undefined,
	])}
}

function traceBadge(acah: AcahProperties): AcahBadge | undefined {
	const trace = acah.trace && typeof acah.trace === 'object' ? acah.trace : undefined
	const status = text(trace?.status)
	if (!status) return undefined
	return {label: `${readable(status)} trace`, title: title([
		`${readable(status)} trace within ACAH's bounded static model; this does not prove runtime reachability or exploitability.`,
		detail('Scope', trace.scope), text(trace.reason) ? `Reason: ${trace.reason}` : undefined,
	])}
}

function testSourceBadge(acah: AcahProperties): AcahBadge | undefined {
	if (acah.scope !== 'test') return undefined
	const source = acah.testSource && typeof acah.testSource === 'object' ? acah.testSource : {}
	const reasons = Array.isArray(source.reasons) ? source.reasons.filter(item => typeof item === 'string').map(readable) : []
	return {label: 'Test source', title: title([
		'Test source', detail('Confidence', source.confidence), detail('Language', source.language),
		reasons.length ? `Evidence: ${reasons.join(', ')}` : undefined,
	])}
}

function contextBadge(label: string, propertyLabel: string, value: unknown): AcahBadge | undefined {
	const item = text(value)
	return item ? {label: `${label} ${readable(item).toLowerCase()}`, title: `${propertyLabel}: ${readable(item)}`} : undefined
}

export function AcahSummary(props: {result: Result}) {
	const acah = getResultAcah(props.result)
	if (!acah) return null
	const badges = [statusBadge(acah), claimBadge(props.result), detectorsBadge(props.result), confidenceBadge(acah), sinkBadge(acah), traceBadge(acah), testSourceBadge(acah),
		contextBadge('Reachability', 'Dependency reachability', acah.reachability),
		contextBadge('Verification', 'Verification', acah.verification)].filter(Boolean) as AcahBadge[]
	if (!badges.length) return null
	return <div className="swcAcahSummary" aria-label="ACAH finding summary">
		{badges.map((badge, index) => <span className="swcAcahBadge" data-swc-tooltip={badge.title} key={index}>{badge.label}</span>)}
	</div>
}
