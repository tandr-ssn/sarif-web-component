// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import {Run} from 'sarif'

type AuditObject = {[key: string]: any}

export interface RunAuditSummaryData {
	label: string
	lines: string[]
	incomplete: boolean
}

function text(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined
}

function readable(value: string): string {
	const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
	return words ? words[0].toUpperCase() + words.slice(1) : words
}

function statusLine(label: string, analysis: AuditObject, details: Array<string | undefined> = []): string | undefined {
	const status = text(analysis?.status)
	if (!status) return undefined
	return `${label}: ${[readable(status), ...details.filter(Boolean)].join(' · ')}`
}

const incompleteStatuses = new Set(['failed', 'error', 'unavailable', 'disabled', 'incomplete', 'partial'])

export function getRunAuditSummary(run: Run): RunAuditSummaryData | undefined {
	const audit = (run.properties as any)?.auditscan
	if (!audit || typeof audit !== 'object' || Array.isArray(audit)) return undefined

	const lines: string[] = []
	const statuses: string[] = []
	const native = audit.native_analysis && typeof audit.native_analysis === 'object' ? audit.native_analysis : {}
	Object.keys(native).sort().forEach(language => {
		const analysis = native[language]
		if (!analysis || typeof analysis !== 'object' || analysis.input_detected === false || analysis.status === 'no-input') return
		const line = statusLine(`Native ${readable(language)}`, analysis)
		if (line) lines.push(line)
		if (text(analysis.status)) statuses.push(analysis.status)
	})

	const dependency = audit.dependency_analysis
	if (dependency && typeof dependency === 'object') {
		const line = statusLine('Dependencies', dependency, [
			text(dependency.reachability) ? `reachability ${dependency.reachability}` : undefined,
		])
		if (line) lines.push(line)
		if (text(dependency.status)) statuses.push(dependency.status)
	}

	const publicRules = audit.public_rule_analysis
	if (publicRules && typeof publicRules === 'object') {
		const line = statusLine('Public rules', publicRules, [
			text(publicRules.verification) ? `verification ${publicRules.verification}` : undefined,
		])
		if (line) lines.push(line)
		if (text(publicRules.status)) statuses.push(publicRules.status)
	}

	const partition = audit.test_source_partition
	if (partition && typeof partition === 'object') {
		const findingCount = typeof partition.finding_count === 'number'
			? `${partition.finding_count} test findings`
			: typeof partition.moved_findings === 'number'
				? `${partition.moved_findings} findings moved`
				: undefined
		const line = statusLine('Test partition', partition, [findingCount])
		if (line) lines.push(line)
		if (text(partition.status)) statuses.push(partition.status)
	}

	if (!lines.length) return undefined
	const diagnostics = Array.isArray(audit.workspace_diagnostics)
		? new Set(audit.workspace_diagnostics.filter(item => typeof item === 'string' && item)).size
		: 0
	const incomplete = statuses.some(status => incompleteStatuses.has(status.toLowerCase()))
	return {
		label: `Analysis ${incomplete ? 'incomplete' : 'succeeded'}${diagnostics ? ` · ${diagnostics} diagnostics` : ''}`,
		lines: [...lines, ...(diagnostics ? [`Diagnostics: ${diagnostics} (details retained in SARIF)`] : [])],
		incomplete,
	}
}

export function RunAuditBadge(props: {summary: RunAuditSummaryData}) {
	return <span className={`swcRunAuditBadge${props.summary.incomplete ? ' swcRunAuditIncomplete' : ''}`}>
		{props.summary.label}
	</span>
}

export function RunAuditDetails(props: {summary: RunAuditSummaryData}) {
	return <div className="swcRunAuditDetails">
		<strong>AuditScan analysis</strong>
		{props.summary.lines.map((line, index) => <div key={index}>{line}</div>)}
	</div>
}
