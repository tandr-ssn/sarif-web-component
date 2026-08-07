import {Location, PhysicalLocation, Result, Stack} from 'sarif'
import {RunStore} from './RunStore'

export type ResultExportScope = 'filtered' | 'all'

function spreadsheetSafe(value: string): string {
	return /^\s*[=+\-@]/.test(value) ? `'${value}` : value
}

function csvCell(value: unknown): string {
	return `"${spreadsheetSafe(String(value ?? '')).replace(/"/g, '""')}"`
}

function messageText(message): string {
	return message?.text ?? message?.markdown ?? ''
}

function physicalLocationText(result: Result, physicalLocation: PhysicalLocation | undefined): string {
	if (!physicalLocation) return ''
	const artifact = physicalLocation.artifactLocation
	const path = artifact?.uri ?? (artifact?.index === undefined ? '' : result.run?.artifacts?.[artifact.index]?.location?.uri) ?? ''
	const line = physicalLocation.region?.startLine
	return path && line ? `${path}:${line}` : path || (line ? `Line ${line}` : '')
}

function traceLocationText(result: Result, location: Location | undefined, index: number, module?: string): string {
	const physicalLocation = location?.physicalLocation
	const logicalLocation = location?.logicalLocations?.[0]
	const description = [
		messageText(location?.message),
		logicalLocation?.fullyQualifiedName ?? logicalLocation?.name ?? module ?? '',
		physicalLocationText(result, physicalLocation),
	].filter(Boolean).join(' — ')
	const snippet = physicalLocation?.contextRegion?.snippet?.text ?? physicalLocation?.region?.snippet?.text ?? ''
	return [`${index + 1}. ${description}`.trimEnd(), snippet].filter(Boolean).join('\n')
}

function stackText(result: Result, stack: Stack, index: number, total: number): string {
	const heading = [total > 1 ? `Call stack ${index + 1}` : '', messageText(stack.message)].filter(Boolean).join(': ')
	const frames = stack.frames?.map((frame, frameIndex) =>
		traceLocationText(result, frame.location, frameIndex, frame.module)).filter(Boolean).join('\n') ?? ''
	return [heading, frames].filter(Boolean).join('\n')
}

function resultCallStackText(result: Result): string {
	return result.stacks?.map((stack, index, stacks) => stackText(result, stack, index, stacks.length))
		.filter(Boolean).join('\n\n') ?? ''
}

function resultCodeFlowText(result: Result): string {
	return result.codeFlows?.map((codeFlow, codeFlowIndex, codeFlows) => {
		const flowHeading = [codeFlows.length > 1 ? `Code flow ${codeFlowIndex + 1}` : '', messageText(codeFlow.message)]
			.filter(Boolean).join(': ')
		const threads = codeFlow.threadFlows?.map((threadFlow, threadIndex, threadFlows) => {
			const threadHeading = [
				threadFlows.length > 1 ? `Thread ${threadIndex + 1}` : '',
				messageText(threadFlow.message) || threadFlow.id || '',
			].filter(Boolean).join(': ')
			const locations = threadFlow.locations?.map((threadFlowLocation, locationIndex) => {
				const resolved = threadFlowLocation.index === undefined
					? threadFlowLocation
					: result.run?.threadFlowLocations?.[threadFlowLocation.index]
				return traceLocationText(result, resolved?.location, locationIndex, resolved?.module)
			}).filter(Boolean).join('\n') ?? ''
			return [threadHeading, locations].filter(Boolean).join('\n')
		}).filter(Boolean).join('\n\n') ?? ''
		return [flowHeading, threads].filter(Boolean).join('\n')
	}).filter(Boolean).join('\n\n') ?? ''
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
