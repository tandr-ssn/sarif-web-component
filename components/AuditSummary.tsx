// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './AuditSummary.scss'
import * as React from 'react'
import {Result} from 'sarif'

type AuditObject = {[key: string]: any}

interface AuditBadge {
	label: string
	title: string
}

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

function statusBadge(audit: AuditObject): AuditBadge | undefined {
	const status = text(audit.status) ?? text(audit.classification)
	if (!status) return undefined
	return {
		label: readable(status),
		title: title([
			detail('Status', audit.status),
			detail('Classification', audit.classification),
			detail('Resolution', audit.resolution),
			detail('Native analysis', audit.native_resolution),
			text(audit.native_reason) ? `Reason: ${audit.native_reason}` : undefined,
		]),
	}
}

function confidenceBadge(audit: AuditObject): AuditBadge | undefined {
	const confidence = text(audit.confidence)
	if (!confidence) return undefined
	return {
		label: `${readable(confidence.toLowerCase())} confidence`,
		title: `Audit confidence: ${readable(confidence.toLowerCase())}`,
	}
}

function sinkBadge(audit: AuditObject): AuditBadge | undefined {
	const family = text(audit.sink_family)
	if (!family) return undefined
	const sink = audit.sink && typeof audit.sink === 'object' ? audit.sink : {}
	const selection = sink.selection && typeof sink.selection === 'object' ? sink.selection : {}
	const parameterization = sink.parameterization && typeof sink.parameterization === 'object' ? sink.parameterization : {}
	return {
		label: readable(family),
		title: title([
			`Sink family: ${readable(family)}`,
			text(sink.symbol) ? `Sink: ${sink.symbol}` : undefined,
			text(sink.overload) ? `Overload: ${sink.overload}` : undefined,
			text(sink.sensitive_parameter) ? `Sensitive parameter: ${sink.sensitive_parameter}` : undefined,
			detail('Selection', selection.status),
			detail('Selection resolution', selection.resolution),
			text(selection.reason) ? `Selection reason: ${selection.reason}` : undefined,
			detail('Parameterization', parameterization.status),
			detail('Parameterization resolution', parameterization.resolution),
			text(parameterization.reason) ? `Parameterization reason: ${parameterization.reason}` : undefined,
		]),
	}
}

function traceBadge(audit: AuditObject): AuditBadge | undefined {
	const trace = audit.trace && typeof audit.trace === 'object' ? audit.trace : undefined
	const status = text(trace?.status)
	if (!status) return undefined
	return {
		label: `${readable(status)} trace`,
		title: title([
			`Trace: ${readable(status)}`,
			detail('Scope', trace.scope),
			text(trace.reason) ? `Reason: ${trace.reason}` : undefined,
		]),
	}
}

function testSourceBadge(audit: AuditObject): AuditBadge | undefined {
	if (audit.scope !== 'test') return undefined
	const source = audit.test_source && typeof audit.test_source === 'object' ? audit.test_source : {}
	const reasons = Array.isArray(source.reasons) ? source.reasons.filter(item => typeof item === 'string').map(readable) : []
	return {
		label: 'Test source',
		title: title([
			'Test source',
			detail('Confidence', source.confidence),
			detail('Language', source.language),
			reasons.length ? `Evidence: ${reasons.join(', ')}` : undefined,
		]),
	}
}

function contextBadge(label: string, propertyLabel: string, value: unknown): AuditBadge | undefined {
	const item = text(value)
	return item ? {label: `${label} ${readable(item).toLowerCase()}`, title: `${propertyLabel}: ${readable(item)}`} : undefined
}

export function AuditSummary(props: {result: Result}) {
	const audit = (props.result.properties as any)?.audit
	if (!audit || typeof audit !== 'object' || Array.isArray(audit)) return null

	const badges = [
		statusBadge(audit),
		confidenceBadge(audit),
		sinkBadge(audit),
		traceBadge(audit),
		testSourceBadge(audit),
		contextBadge('Reachability', 'Dependency reachability', audit.reachability),
		contextBadge('Verification', 'Verification', audit.verification),
	].filter(Boolean) as AuditBadge[]
	if (!badges.length) return null

	return <div className="swcAuditSummary" aria-label="AuditScan finding summary">
		{badges.map((badge, index) => <span className="swcAuditBadge" title={badge.title} key={index}>{badge.label}</span>)}
	</div>
}
