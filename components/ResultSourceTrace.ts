// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {PhysicalLocation, Region, Result, Run, ThreadFlowLocation} from 'sarif'
import {getArtifactLocation, SourceTrace} from './SourceFile'
import {getResultAcah, getTraceStepSymbol} from './Acah'

export function getResultAcahOrigin(result: Result): SourceTrace['origin'] | undefined {
	const origin = getResultAcah(result)?.origin
	const originLocation = origin?.location
	const path = originLocation?.path ?? originLocation?.uri
	const line = originLocation?.line ?? originLocation?.startLine
	const column = originLocation?.column ?? originLocation?.startColumn
	if (typeof path !== 'string' || typeof line !== 'number') return undefined
	const name = typeof origin.name === 'string' ? origin.name : undefined
	return {
		location: {
			artifactLocation: {uri: path},
			region: {
				startLine: line,
				...(typeof column === 'number' ? {startColumn: column} : {}),
				...(typeof originLocation.endLine === 'number' ? {endLine: originLocation.endLine} : {}),
				...(typeof originLocation.endColumn === 'number'
					? {endColumn: originLocation.endColumn}
					: typeof column === 'number' && name ? {endColumn: column + name.length} : {}),
			},
		},
		...(name ? {name} : {}),
		...(typeof origin.kind === 'string' ? {kind: origin.kind} : {}),
	}
}

function artifactKey(location: PhysicalLocation | undefined, run: Run): string | undefined {
	const artifact = getArtifactLocation(location, run)
	if (!artifact) return undefined
	if (artifact.uri !== undefined) {
		let uri = artifact.uri
		try { uri = decodeURIComponent(uri) } catch (_) { }
		uri = uri.replace(/\\/g, '/')
		return /^[a-zA-Z]:\//.test(uri) ? uri.toLowerCase() : uri
	}
	return artifact.index === undefined ? undefined : `index:${artifact.index}`
}

function regionsOverlap(left: Region | undefined, right: Region | undefined): boolean {
	if (!left?.startLine || !right?.startLine) return !left?.startLine && !right?.startLine
	const leftEndLine = left.endLine ?? left.startLine
	const rightEndLine = right.endLine ?? right.startLine
	const overlapLine = Math.max(left.startLine, right.startLine)
	const overlapEndLine = Math.min(leftEndLine, rightEndLine)
	if (overlapLine > overlapEndLine) return false
	if (overlapLine < overlapEndLine) return true
	const startColumn = (region: Region) => region.startLine === overlapLine ? region.startColumn ?? 1 : 1
	const endColumn = (region: Region, endLine: number) => endLine === overlapLine ? region.endColumn ?? Infinity : Infinity
	return startColumn(left) < endColumn(right, rightEndLine) && startColumn(right) < endColumn(left, leftEndLine)
}

function sameSourceLocation(left: PhysicalLocation | undefined, right: PhysicalLocation, run: Run): boolean {
	const leftKey = artifactKey(left, run)
	return leftKey !== undefined && leftKey === artifactKey(right, run) && regionsOverlap(left?.region, right.region)
}

function withPrimaryLocation(
	locations: Array<PhysicalLocation | undefined>,
	primary: PhysicalLocation,
	run: Run,
	identifierHints?: Array<string | undefined>,
	steps?: Array<ThreadFlowLocation | undefined>,
): SourceTrace {
	let activeIndex = -1
	for (let index = locations.length - 1; index >= 0; index--) {
		if (sameSourceLocation(locations[index], primary, run)) {
			activeIndex = index
			break
		}
	}
	if (activeIndex < 0) {
		locations = [...locations, primary]
		if (identifierHints) identifierHints = [...identifierHints, undefined]
		if (steps) steps = [...steps, undefined]
		activeIndex = locations.length - 1
	}
	return {
		locations,
		activeIndex,
		...(steps ? {steps} : {}),
		...(identifierHints?.some(Boolean) ? {identifierHints} : {}),
	}
}

/** Returns the first code flow, or first call stack, leading to a result's primary location. */
export function getResultSourceTrace(result: Result): SourceTrace | undefined {
	const primary = result.locations?.[0]?.physicalLocation
	if (!primary) return undefined
	const origin = getResultAcahOrigin(result)

	const threadFlow = result.codeFlows?.find(codeFlow => codeFlow.threadFlows?.length)?.threadFlows?.[0]
	if (threadFlow?.locations?.length) {
		const resolvedLocations = threadFlow.locations.map(location => {
			const resolved = location.index === undefined ? location : result.run.threadFlowLocations?.[location.index]
			return resolved
		})
		const identifierHints = resolvedLocations.map(resolved => {
			const acahSymbol = getTraceStepSymbol(resolved, result.run)
			if (acahSymbol) return acahSymbol
			const identifiers = Object.keys(resolved?.state ?? {}).filter(key => /^[A-Za-z_$][\w$]*$/.test(key))
			return identifiers.length === 1 ? identifiers[0] : undefined
		})
		return {
			...withPrimaryLocation(
				resolvedLocations.map(resolved => resolved?.location?.physicalLocation),
				primary,
				result.run,
				identifierHints,
				resolvedLocations,
			),
			label: 'Code flow',
			inferIdentifiers: true,
			...(origin ? {origin} : {}),
		}
	}

	const stack = result.stacks?.find(candidate => candidate.frames?.length)
	if (stack?.frames?.length) {
		return {
			...withPrimaryLocation(stack.frames.map(frame => frame.location?.physicalLocation), primary, result.run),
			label: 'Call stack',
			...(origin ? {origin} : {}),
		}
	}
	return undefined
}
