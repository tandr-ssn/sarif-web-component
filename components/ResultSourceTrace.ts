// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {PhysicalLocation, Result} from 'sarif'
import {SourceTrace} from './SourceFile'

export function getResultAuditOrigin(result: Result): SourceTrace['origin'] | undefined {
	const origin = (result.properties as any)?.audit?.origin
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

function locationKey(location: PhysicalLocation | undefined): string | undefined {
	const artifact = location?.artifactLocation
	if (!artifact) return undefined
	const region = location?.region
	return [artifact.uriBaseId, artifact.uri, artifact.index, region?.startLine, region?.startColumn, region?.endLine, region?.endColumn].join('\0')
}

function withPrimaryLocation(locations: Array<PhysicalLocation | undefined>, primary: PhysicalLocation, identifierHints?: Array<string | undefined>): SourceTrace {
	const primaryKey = locationKey(primary)
	let activeIndex = locations.findIndex(location => locationKey(location) === primaryKey)
	if (activeIndex < 0) {
		locations = [...locations, primary]
		if (identifierHints) identifierHints = [...identifierHints, undefined]
		activeIndex = locations.length - 1
	}
	return {locations, activeIndex, ...(identifierHints?.some(Boolean) ? {identifierHints} : {})}
}

/** Returns the first code flow, or first call stack, leading to a result's primary location. */
export function getResultSourceTrace(result: Result): SourceTrace | undefined {
	const primary = result.locations?.[0]?.physicalLocation
	if (!primary) return undefined
	const origin = getResultAuditOrigin(result)

	const threadFlow = result.codeFlows?.find(codeFlow => codeFlow.threadFlows?.length)?.threadFlows?.[0]
	if (threadFlow?.locations?.length) {
		const resolvedLocations = threadFlow.locations.map(location => {
			const resolved = location.index === undefined ? location : result.run.threadFlowLocations?.[location.index]
			return resolved
		})
		const identifierHints = resolvedLocations.map(resolved => {
			const identifiers = Object.keys(resolved?.state ?? {}).filter(key => /^[A-Za-z_$][\w$]*$/.test(key))
			return identifiers.length === 1 ? identifiers[0] : undefined
		})
		return {
			...withPrimaryLocation(resolvedLocations.map(resolved => resolved?.location?.physicalLocation), primary, identifierHints),
			label: 'Code flow',
			inferIdentifiers: true,
			...(origin ? {origin} : {}),
		}
	}

	const stack = result.stacks?.find(candidate => candidate.frames?.length)
	if (stack?.frames?.length) {
		return {
			...withPrimaryLocation(stack.frames.map(frame => frame.location?.physicalLocation), primary),
			label: 'Call stack',
			...(origin ? {origin} : {}),
		}
	}
	return undefined
}
