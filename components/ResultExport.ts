import {Result} from 'sarif'
import {RunStore} from './RunStore'
import {resultCallStackText, resultCodeFlowText} from './ResultTraceText'

export type ResultExportScope = 'filtered' | 'all'

function spreadsheetSafe(value: string): string {
	return /^\s*[=+\-@]/.test(value) ? `'${value}` : value
}

function csvCell(value: unknown): string {
	return `"${spreadsheetSafe(String(value ?? '')).replace(/"/g, '""')}"`
}

export function createResultCsv(runStores: ReadonlyArray<RunStore>, scope: ResultExportScope): string {
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
	return '\ufeff' + [fields, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
}

export function downloadResultCsv(csv: string, fileName: string): void {
	const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}))
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = fileName
	anchor.style.display = 'none'
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
	window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
