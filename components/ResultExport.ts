import {Result} from 'sarif'
import {RunStore} from './RunStore'
import {resultCallStackText, resultCodeFlowText} from './ResultTraceText'
import {getResultFieldDisplayNames, looksLikeMarkdown} from './ResultFields'
import {markdownToHtml, markdownToPlainText} from './MarkdownText'

export type ResultExportScope = 'filtered' | 'all'
export type ResultExportFormat = 'csv-plain' | 'csv-raw' | 'tsv' | 'html' | 'html-table' | 'text' | 'markdown'
export type ResultCsvValueFormat = 'raw' | 'plain'

function spreadsheetSafe(value: string): string {
	return /^\s*[=+\-@]/.test(value) ? `'${value}` : value
}

function csvCell(value: unknown): string {
	return `"${spreadsheetSafe(String(value ?? '')).replace(/"/g, '""')}"`
}

function tsvCell(value: string): string {
	const safe = spreadsheetSafe(value).replace(/\t/g, ' ')
	return /["\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function exportRows(runStores: ReadonlyArray<RunStore>, scope: ResultExportScope): {fields: string[], rows: string[][]} {
	const baseFields = runStores[0]?.columns.map(column => column.id) ?? []
	const exportResults = runStores.flatMap(runStore => {
		const columns = new Map(runStore.columns.map(column => [column.id, column]))
		const results = scope === 'filtered' ? runStore.filteredResults : runStore.visibleResults
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

function exportFieldLabels(fields: string[]): string[] {
	const displayNames = getResultFieldDisplayNames(fields)
	return fields.map(field => displayNames.get(field) ?? field)
}

export function createResultCsv(runStores: ReadonlyArray<RunStore>, scope: ResultExportScope, valueFormat: ResultCsvValueFormat = 'raw'): string {
	const {fields, rows} = exportRows(runStores, scope)
	const labels = exportFieldLabels(fields)
	const formattedRows = valueFormat === 'plain'
		? plainRows(fields, rows)
		: rows
	return '\ufeff' + [labels, ...formattedRows].map(row => row.map(csvCell).join(',')).join('\r\n')
}

function plainValue(field: string, value: string): string {
	return looksLikeMarkdown(field, value) || looksLikeMarkdown('value.text', value) ? markdownToPlainText(value) : value
}

function plainRows(fields: string[], rows: string[][]): string[][] {
	return rows.map(row => row.map((value, index) => plainValue(fields[index], value)))
}

export function createResultTsv(runStores: ReadonlyArray<RunStore>, scope: ResultExportScope): string {
	const {fields, rows} = exportRows(runStores, scope)
	return [exportFieldLabels(fields), ...plainRows(fields, rows)].map(row => row.map(tsvCell).join('\t')).join('\r\n')
}

export function createResultText(runStores: ReadonlyArray<RunStore>, scope: ResultExportScope): string {
	const {fields, rows} = exportRows(runStores, scope)
	const labels = exportFieldLabels(fields)
	const findings = plainRows(fields, rows).flatMap((row, index) => [
		`Finding ${index + 1}`,
		'─'.repeat(`Finding ${index + 1}`.length),
		...labels.flatMap((label, fieldIndex) => [
			`${label}:`,
			(row[fieldIndex] || '(empty)').split('\n').map(line => `  ${line}`).join('\n'),
		]),
		'',
	])
	return ['SARIF findings', '==============', '', ...findings].join('\n').trimEnd() + '\n'
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function htmlValue(field: string, value: string): string {
	if (looksLikeMarkdown(field, value) || looksLikeMarkdown('value.text', value)) return markdownToHtml(value)
	const trimmed = value.trim()
	if (/^https?:\/\/\S+$/.test(trimmed)) {
		const href = escapeHtml(trimmed)
		return `<p><a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a></p>`
	}
	return `<pre>${escapeHtml(trimmed)}</pre>`
}

export function createResultHtml(runStores: ReadonlyArray<RunStore>, scope: ResultExportScope): string {
	const {fields, rows} = exportRows(runStores, scope)
	const labels = exportFieldLabels(fields)
	const findings = rows.map((row, index) => `<section><h2>Finding ${index + 1}</h2>${fields.map((field, fieldIndex) =>
		`<h3>${escapeHtml(labels[fieldIndex])}</h3>${htmlValue(field, row[fieldIndex])}`).join('')}</section>`).join('')
	return '<!doctype html><html><head><meta charset="utf-8"><title>SARIF findings</title><style>'
		+ 'body{font:16px/1.45 Arial,sans-serif;margin:24px;max-width:1100px}section{border-top:1px solid #bbb;margin-top:24px}'
		+ 'pre{white-space:pre-wrap}table{border-collapse:collapse}th,td{border:1px solid #aaa;padding:4px 8px;text-align:left}'
		+ 'code{background:#eee;padding:1px 3px}blockquote{border-left:4px solid #bbb;margin-left:0;padding-left:12px}'
		+ '</style></head><body><h1>SARIF findings</h1>' + findings + '</body></html>\n'
}

/** Creates a rendered HTML table while retaining the selected logical export columns. */
export function createResultHtmlTable(runStores: ReadonlyArray<RunStore>, scope: ResultExportScope): string {
	const {fields, rows} = exportRows(runStores, scope)
	const labels = exportFieldLabels(fields)
	const header = `<thead><tr>${labels.map(label => `<th>${escapeHtml(label)}</th>`).join('')}</tr></thead>`
	const body = `<tbody>${rows.map(row => `<tr>${fields.map((field, fieldIndex) =>
		`<td>${htmlValue(field, row[fieldIndex])}</td>`).join('')}</tr>`).join('')}</tbody>`
	return '<!doctype html><html><head><meta charset="utf-8"><title>SARIF findings table</title><style>'
		+ 'body{font:14px/1.4 Arial,sans-serif;margin:24px;color:#242424}h1{font-size:24px}'
		+ '.table-wrap{overflow-x:auto}table{border-collapse:collapse}table.findings{width:100%}'
		+ 'th,td{border:1px solid #aaa;padding:6px 9px;text-align:left;vertical-align:top}'
		+ 'table.findings>thead>tr>th{background:#f0f0f0;font-weight:700;position:sticky;top:0}'
		+ 'table.findings>tbody>tr:nth-child(even)>td{background:#fafafa}'
		+ 'pre{font:inherit;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}p{margin:0 0 8px}p:last-child{margin-bottom:0}'
		+ 'code{background:#eee;padding:1px 3px}blockquote{border-left:4px solid #bbb;margin-left:0;padding-left:12px}'
		+ 'a{overflow-wrap:anywhere}'
		+ '</style></head><body><h1>SARIF findings</h1><div class="table-wrap"><table class="findings">'
		+ header + body + '</table></div></body></html>\n'
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
	const labels = exportFieldLabels(fields)
	const findings = rows.flatMap((row, index) => [
		`## Finding ${index + 1}`,
		'',
		...fields.flatMap((field, fieldIndex) => [
			`### ${escapeMarkdownText(labels[fieldIndex])}`,
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
