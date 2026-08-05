// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {ArtifactLocation, Log, PhysicalLocation, Result, Run} from 'sarif'
import {getArtifactLocation, SourceFileReader} from './SourceFile'

export interface FileSystemFileHandleLike {
	getFile(): Promise<File>
}

export interface FileSystemDirectoryHandleLike {
	readonly name: string
	getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandleLike>
	getFileHandle(name: string): Promise<FileSystemFileHandleLike>
}

declare global {
	interface Window {
		showDirectoryPicker?: (options?: { id?: string, mode?: 'read' | 'readwrite', startIn?: string }) => Promise<FileSystemDirectoryHandleLike>
	}
}

function decodeArtifactPath(uri: string): { path: string, absolute: boolean } | undefined {
	let decoded = uri
	try { decoded = decodeURIComponent(uri) } catch (_) { }

	if (/^[a-zA-Z]:[\\/]/.test(decoded)) {
		return { path: decoded.replace(/\\/g, '/'), absolute: true }
	}

	try {
		const parsed = new URL(decoded)
		if (parsed.protocol !== 'file:') return undefined
		let path = decodeURIComponent(parsed.pathname).replace(/\\/g, '/')
		if (/^\/[a-zA-Z]:\//.test(path)) path = path.slice(1)
		return { path, absolute: true }
	} catch (_) { }

	return {
		path: decoded.replace(/\\/g, '/'),
		absolute: decoded.startsWith('/'),
	}
}

function normalizeSegments(path: string): string[] | undefined {
	const segments: string[] = []
	for (const segment of path.split('/')) {
		if (!segment || segment === '.') continue
		if (segment === '..') {
			if (!segments.length) return undefined
			segments.pop()
			continue
		}
		segments.push(segment)
	}
	return segments
}

function parentPath(path: string): string {
	const slash = path.lastIndexOf('/')
	return slash < 0 ? '' : path.slice(0, slash)
}

function commonPath(paths: string[]): string | undefined {
	if (!paths.length) return undefined
	const splitPaths = paths.map(path => parentPath(path).split('/').filter(Boolean))
	const common: string[] = []
	for (let index = 0; index < Math.min(...splitPaths.map(parts => parts.length)); index++) {
		const segment = splitPaths[0][index]
		if (!splitPaths.every(parts => parts[index] === segment)) break
		common.push(segment)
	}
	if (!common.length) return undefined
	const firstPath = paths[0]
	const prefix = firstPath.startsWith('/') ? '/' : ''
	return prefix + common.join('/')
}

function physicalLocations(result: Result, run: Run): PhysicalLocation[] {
	const locations: PhysicalLocation[] = []
	const addLocation = location => {
		if (location?.physicalLocation) locations.push(location.physicalLocation)
	}

	result.locations?.forEach(addLocation)
	if (result.analysisTarget) locations.push({ artifactLocation: result.analysisTarget })
	result.stacks?.forEach(stack => stack.frames?.forEach(frame => addLocation(frame.location)))
	result.codeFlows?.forEach(codeFlow => codeFlow.threadFlows?.forEach(threadFlow => threadFlow.locations?.forEach(threadFlowLocation => {
		const resolved = threadFlowLocation.index === undefined
			? threadFlowLocation
			: run.threadFlowLocations?.[threadFlowLocation.index]
		addLocation(resolved?.location)
		resolved?.stack?.frames?.forEach(frame => addLocation(frame.location))
	})))
	return locations
}

export function getCommonAbsoluteSourceRoot(logs: Log[] | undefined): string | undefined {
	const findingPaths: string[] = []
	const tracePaths: string[] = []
	const addPath = (ploc: PhysicalLocation, run: Run, paths: string[]) => {
		const uri = getArtifactLocation(ploc, run)?.uri
		const decoded = uri && decodeArtifactPath(uri)
		if (decoded?.absolute) paths.push(decoded.path)
	}

	logs?.forEach(log => log.runs?.forEach(run => run.results?.forEach(result => {
		result.locations?.forEach(location => location.physicalLocation && addPath(location.physicalLocation, run, findingPaths))
		if (result.analysisTarget) addPath({ artifactLocation: result.analysisTarget }, run, findingPaths)
		physicalLocations(result, run).forEach(ploc => addPath(ploc, run, tracePaths))
	})))
	return commonPath(findingPaths) ?? (!findingPaths.length ? commonPath(tracePaths) : undefined)
}

export function createLocalSourceFileReader(
	root: FileSystemDirectoryHandleLike,
	commonAbsoluteRoot?: string,
): SourceFileReader {
	return async (artifactLocation: ArtifactLocation) => {
		if (!artifactLocation.uri) return undefined
		const decoded = decodeArtifactPath(artifactLocation.uri)
		if (!decoded) return undefined

		let path = decoded.path
		if (decoded.absolute) {
			if (!commonAbsoluteRoot) return undefined
			const normalizedRoot = commonAbsoluteRoot.replace(/\\/g, '/').replace(/\/$/, '')
			const ignoreCase = /^[a-zA-Z]:\//.test(path) && /^[a-zA-Z]:\//.test(normalizedRoot)
			const comparablePath = ignoreCase ? path.toLowerCase() : path
			const comparableRoot = ignoreCase ? normalizedRoot.toLowerCase() : normalizedRoot
			if (comparablePath !== comparableRoot && !comparablePath.startsWith(`${comparableRoot}/`)) return undefined
			path = path.slice(normalizedRoot.length)
		}

		const segments = normalizeSegments(path)
		if (!segments?.length) return undefined
		let directory = root
		for (const segment of segments.slice(0, -1)) {
			directory = await directory.getDirectoryHandle(segment)
		}
		const file = await (await directory.getFileHandle(segments[segments.length - 1])).getFile()
		return { name: file.name, text: await file.text() }
	}
}
