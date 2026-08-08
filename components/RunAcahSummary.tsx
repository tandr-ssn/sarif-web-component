// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import {Run} from 'sarif'
import {AcahProperties, getRunAcah} from './Acah'

export interface RunAcahSummaryData { label: string; lines: string[]; incomplete: boolean }

function text(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined
}

function readable(value: string): string {
	const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
	return words ? words[0].toUpperCase() + words.slice(1) : words
}

function statusLine(label: string, analysis: AcahProperties, details: Array<string | undefined> = []): string | undefined {
	const status = text(analysis?.status)
	return status ? `${label}: ${[readable(status), ...details.filter(Boolean)].join(' · ')}` : undefined
}

const incompleteStatuses = new Set(['failed', 'error', 'unavailable', 'disabled', 'incomplete', 'partial'])

export function getRunAcahSummary(run: Run): RunAcahSummaryData | undefined {
	const acah = getRunAcah(run)
	if (!acah) return undefined
	const lines: string[] = ['Format: ACAH SARIF v3']
	const statuses: string[] = []
	const native = acah.nativeAnalysis && typeof acah.nativeAnalysis === 'object' ? acah.nativeAnalysis : {}
	Object.keys(native).sort().forEach(language => {
		const analysis = native[language]
		if (!analysis || typeof analysis !== 'object' || analysis.inputDetected === false || analysis.status === 'no-input') return
		const line = statusLine(`Native ${readable(language)}`, analysis, [text(analysis.version) ? `version ${analysis.version}` : undefined])
		if (line) lines.push(line)
		if (text(analysis.status)) statuses.push(analysis.status)
	})

	const dependency = acah.dependencyAnalysis
	if (dependency && typeof dependency === 'object') {
		const line = statusLine('Dependencies', dependency, [text(dependency.coverage),
			text(dependency.reachability) ? `reachability ${dependency.reachability}` : undefined])
		if (line) lines.push(line)
		if (text(dependency.status)) statuses.push(dependency.status)
	}
	const publicRules = acah.publicRuleAnalysis
	if (publicRules && typeof publicRules === 'object') {
		const line = statusLine('Public rules', publicRules, [
			text(publicRules.verification) ? `verification ${publicRules.verification}` : undefined])
		if (line) lines.push(line)
		if (text(publicRules.status)) statuses.push(publicRules.status)
	}
	const partition = acah.testSourcePartition
	if (partition && typeof partition === 'object') {
		const count = typeof partition.findingCount === 'number' ? `${partition.findingCount} test findings`
			: typeof partition.movedFindings === 'number' ? `${partition.movedFindings} findings moved` : undefined
		const line = statusLine('Test partition', partition, [count])
		if (line) lines.push(line)
	}

	const cache = acah.semgrepCache
	if (cache && typeof cache === 'object' && text(cache.status)) {
		lines.push(`Semgrep cache: ${readable(cache.status)} · ${cache.reused === true ? 'evidence reused' : 'evidence scanned'} · provenance only`)
	}
	const filteredLabels = [
		['filteredStaleConstruction', 'stale construction'], ['filteredParameterizedSqlFindings', 'parameterized SQL'],
		['filteredTypedSinkMismatches', 'typed sink mismatches'], ['filteredReclassifiedInventoryDuplicates', 'inventory duplicates'],
		['filteredRedundantWrapperCandidates', 'wrapper duplicates'],
	] as Array<[string, string]>
	const filtered = filteredLabels.map(([property, label]) => [label, Array.isArray(acah[property]) ? acah[property].length : 0] as [string, number])
		.filter(([, count]) => count > 0)
	if (filtered.length) lines.push(`Filtered evidence: ${filtered.map(([label, count]) => `${count} ${label}`).join(', ')}`)

	const diagnostics = Array.isArray(acah.workspaceDiagnostics)
		? new Set(acah.workspaceDiagnostics.filter(item => typeof item === 'string' && item)).size : 0
	if (diagnostics) lines.push(`Diagnostics: ${diagnostics} (details retained in SARIF)`)
	const incomplete = statuses.some(status => incompleteStatuses.has(status.toLowerCase()))
	const label = statuses.length ? `ACAH analysis ${incomplete ? 'incomplete' : 'succeeded'}` : 'ACAH v3'
	return {label: `${label}${diagnostics ? ` · ${diagnostics} diagnostics` : ''}`, lines, incomplete}
}

export function RunAcahBadge(props: {summary: RunAcahSummaryData}) {
	return <span className={`swcRunAcahBadge${props.summary.incomplete ? ' swcRunAcahIncomplete' : ''}`}>{props.summary.label}</span>
}

export function RunAcahDetails(props: {summary: RunAcahSummaryData}) {
	return <div className="swcRunAcahDetails"><strong>ACAH analysis</strong>
		{props.summary.lines.map((line, index) => <div key={index}>{line}</div>)}</div>
}
