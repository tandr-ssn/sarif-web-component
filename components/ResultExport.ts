import {Result} from 'sarif'
import {RunStore} from './RunStore'
import {resultCallStackText, resultCodeFlowText} from './ResultTraceText'
import {looksLikeMarkdown} from './ResultFields'

export type ResultExportScope = 'filtered' | 'all'
export type ResultExportFormat = 'csv' | 'markdown'

function spreadsheetSafe(value: string): string {
	return /^\s*[=+\-@]/.test(value) ? `'${value}` : value
}

function csvCell(value: unknown): string {
	return `"${spreadsheetSafe(String(value ?? '')).replace(/"/g, '""')}"`
}

function exportRows(runStores: ReadonlyArray<RunStore>, scope: ResultExportScope): {fields: string[], rows: string[][]} {
	const baseFields = runStores[0]?.columns.map(column => column.id) ?? []
	const exportResults = runStores.flatMap(runStore => {
		const columns = new Map(runStore.columns.map(column => [column.id, column]))
		const results = scope === 'filtered' ? runStore.filteredResults : runStore.run.results ?? []
		return results.map((result: Result) => ({columns, result}))
	})
	const traceFields = [
		exportResults.some(({result}) => result.codeFlows?.length) ? 'Code flow' : undefined,
		exportResults.some(({result}) => result.stacks?.length) ? 'Call stack' : undefined,
	].filter((field): field is string => field !== undefined)
	const fields = baseFields.slice()
	fields.splice(Math.max(0, fields.indexOf('Details') + 1), 0, ...traceFields)
	const rows = exportResults.map(({columns, result}) => fields.map(field => {
		if (field === 'Code flow') return resultCodeFlowText(result)
		if (field === 'Call stack') return resultCallStackText(result)
		return columns.get(field)?.filterString(result) ?? ''
	}))
	return {fields, rows}
}

export function createResultCsv(runStores: ReadonlyArray<RunStore>, scope: ResultExportScope): string {
	const {fields, rows} = exportRows(runStores, scope)
	return '\ufeff' + [fields, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
}

function escapeMarkdownText(value: string): string {
	return value.replace(/([\\`*_[\]{}<>#+\-.!|])/g, '\\$1')
}

function markdownValue(field: string, value: string): string {
	const trimmed = value.trim()
	if (!trimmed) return '_Empty_'
	if (looksLikeMarkdown(field, trimmed)) return trimmed
	if (/^https?:\/\/\S+$/.test(trimmed)) return `<${trimmed}>`
	if (!trimmed.includes('\n')) return escapeMarkdownText(trimmed)
	let longestTicks = 0
	trimmed.replace(/`+/g, ticks => {
		longestTicks = Math.max(longestTicks, ticks.length)
		return ticks
	})
	const fence = '`'.repeat(Math.max(3, longestTicks + 1))
	return `${fence}text\n${trimmed}\n${fence}`
}

/** Creates a readable report which preserves Markdown-valued selected fields. */
export function createResultMarkdown(runStores: ReadonlyArray<RunStore>, scope: ResultExportScope): string {
	const {fields, rows} = exportRows(runStores, scope)
	const findings = rows.flatMap((row, index) => [
		`## Finding ${index + 1}`,
		'',
		...fields.flatMap((field, fieldIndex) => [
			`### ${escapeMarkdownText(field)}`,
			'',
			markdownValue(field, row[fieldIndex]),
			'',
		]),
	])
	return ['# SARIF findings', '', ...findings].join('\n').trimEnd() + '\n'
}

export function downloadResultFile(content: string, fileName: string, type: string): void {
	const url = URL.createObjectURL(new Blob([content], {type}))
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = fileName
	anchor.style.display = 'none'
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
	window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadResultCsv(csv: string, fileName: string): void {
	downloadResultFile(csv, fileName, 'text/csv;charset=utf-8')
}
