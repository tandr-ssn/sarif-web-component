// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {PhysicalLocation, Result} from 'sarif'
import {SourceTrace} from './SourceFile'

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
		}
	}

	const stack = result.stacks?.find(candidate => candidate.frames?.length)
	if (stack?.frames?.length) {
		return {
			...withPrimaryLocation(stack.frames.map(frame => frame.location?.physicalLocation), primary),
			label: 'Call stack',
		}
	}
	return undefined
}
