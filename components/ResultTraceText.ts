import {CodeFlow, Location, PhysicalLocation, Result, Stack} from 'sarif'
import {getSourcePathFromSarifRoot} from './LocalSourceFile'

function messageText(message): string {
	return message?.text ?? message?.markdown ?? ''
}

export function physicalLocationText(result: Result, physicalLocation: PhysicalLocation | undefined): string {
	if (!physicalLocation) return ''
	const artifact = physicalLocation.artifactLocation
	const rawPath = artifact?.uri ?? (artifact?.index === undefined ? '' : result.run?.artifacts?.[artifact.index]?.location?.uri) ?? ''
	const path = rawPath && result.run ? getSourcePathFromSarifRoot(rawPath, result.run, artifact) : rawPath
	const line = physicalLocation.region?.startLine
	return path && line ? `${path}:${line}` : path || (line ? `Line ${line}` : '')
}

export function numberedSnippetText(physicalLocation: PhysicalLocation | undefined): string {
	const snippetRegion = physicalLocation?.contextRegion?.snippet?.text !== undefined
		? physicalLocation.contextRegion
		: physicalLocation?.region
	const snippet = snippetRegion?.snippet?.text
	if (!snippet) return ''
	const lines = snippet.replace(/\r\n?/g, '\n').split('\n')
	if (lines[lines.length - 1] === '') lines.pop()
	const firstLine = snippetRegion.startLine ?? physicalLocation?.region?.startLine ?? 1
	const width = String(firstLine + Math.max(0, lines.length - 1)).length
	return lines.map((line, index) => `${String(firstLine + index).padStart(width)}  ${line}`).join('\n')
}

function traceLocationText(result: Result, location: Location | undefined, index: number, module?: string): string {
	const physicalLocation = location?.physicalLocation
	const logicalLocation = location?.logicalLocations?.[0]
	const description = [
		messageText(location?.message),
		logicalLocation?.fullyQualifiedName ?? logicalLocation?.name ?? module ?? '',
		physicalLocationText(result, physicalLocation),
	].filter(Boolean).join(' — ')
	return [`${index + 1}. ${description}`.trimEnd(), numberedSnippetText(physicalLocation)].filter(Boolean).join('\n')
}

export function stackText(result: Result, stack: Stack, index: number, total: number): string {
	const heading = [total > 1 ? `Call stack ${index + 1}` : '', messageText(stack.message)].filter(Boolean).join(': ')
	const frames = stack.frames?.map((frame, frameIndex) =>
		traceLocationText(result, frame.location, frameIndex, frame.module)).filter(Boolean).join('\n') ?? ''
	return [heading, frames].filter(Boolean).join('\n')
}

export function resultCallStackText(result: Result): string {
	return result.stacks?.map((stack, index, stacks) => stackText(result, stack, index, stacks.length))
		.filter(Boolean).join('\n\n') ?? ''
}

export function codeFlowText(result: Result, codeFlow: CodeFlow, index: number, total: number): string {
	const flowHeading = [total > 1 ? `Code flow ${index + 1}` : '', messageText(codeFlow.message)]
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
}

export function resultCodeFlowText(result: Result): string {
	return result.codeFlows?.map((flow, index, flows) => codeFlowText(result, flow, index, flows.length))
		.filter(Boolean).join('\n\n') ?? ''
}

export function resultDetailsCopyText(result: Result): string {
	const message = result.message?.markdown ?? result.message?.text ?? ''
	const physicalLocation = result.locations?.[0]?.physicalLocation
	const snippet = numberedSnippetText(physicalLocation)
	const location = snippet ? physicalLocationText(result, physicalLocation) : ''
	return [message, [location, snippet].filter(Boolean).join('\n')].filter(Boolean).join('\n\n')
}
