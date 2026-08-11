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

const inferredSourceRoots = new WeakMap<Run, string | undefined>()

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

function artifactSegmentCandidates(uri: string, commonAbsoluteRoot?: string, selectedRootName?: string): string[][] {
	const decoded = decodeArtifactPath(uri)
	if (!decoded) return []

	if (!decoded.absolute) {
		const segments = normalizeSegments(decoded.path)
		return segments?.length ? [segments] : []
	}

	const candidates: string[][] = []
	const absoluteSegments = normalizeSegments(decoded.path)
	if (absoluteSegments?.length && selectedRootName) {
		const ignoreCase = /^[a-zA-Z]:\//.test(decoded.path)
		const comparableRootName = ignoreCase ? selectedRootName.toLowerCase() : selectedRootName
		absoluteSegments.forEach((segment, index) => {
			const comparableSegment = ignoreCase ? segment.toLowerCase() : segment
			const relative = absoluteSegments.slice(index + 1)
			if (comparableSegment === comparableRootName && relative.length) candidates.push(relative)
		})
	}

	if (commonAbsoluteRoot) {
		const normalizedRoot = commonAbsoluteRoot.replace(/\\/g, '/').replace(/\/$/, '')
		const ignoreCase = /^[a-zA-Z]:\//.test(decoded.path) && /^[a-zA-Z]:\//.test(normalizedRoot)
		const comparablePath = ignoreCase ? decoded.path.toLowerCase() : decoded.path
		const comparableRoot = ignoreCase ? normalizedRoot.toLowerCase() : normalizedRoot
		if (comparablePath.startsWith(`${comparableRoot}/`)) {
			const segments = normalizeSegments(decoded.path.slice(normalizedRoot.length))
			if (segments?.length) candidates.push(segments)
		}
	}

	return candidates.filter((candidate, index) =>
		candidates.findIndex(other => other.join('/') === candidate.join('/')) === index)
}

/** Formats an artifact URI from the actively selected source root, while keeping the root name visible. */
export function getSourcePathFromRoot(uri: string, selectedRootName: string, commonAbsoluteRoot?: string): string {
	const decoded = decodeArtifactPath(uri)
	if (!decoded) return uri

	if (!decoded.absolute) {
		const segments = normalizeSegments(decoded.path)
		if (!segments) return uri
		if (!segments.length) return selectedRootName
		const rootMatches = segments[0] === selectedRootName
		return [selectedRootName, ...segments.slice(rootMatches ? 1 : 0)].join('/')
	}

	const relative = artifactSegmentCandidates(uri, commonAbsoluteRoot, selectedRootName)[0]
	return relative?.length ? [selectedRootName, ...relative].join('/') : uri
}

/** Formats a path relative to the source root recorded by the SARIF producer. */
export function getSourcePathFromSarifRoot(uri: string, run: Run, artifactLocation?: ArtifactLocation): string {
	const baseRoot = artifactLocation?.uriBaseId && run.originalUriBaseIds?.[artifactLocation.uriBaseId]?.uri
	const mappedRoot = run.versionControlProvenance?.find(details => details.mappedTo?.uri)?.mappedTo?.uri
	let root = decodeArtifactPath(baseRoot ?? mappedRoot ?? '')
	if (!root?.absolute) {
		if (!inferredSourceRoots.has(run)) inferredSourceRoots.set(run,
			getCommonAbsoluteSourceRoot([{version: '2.1.0', runs: [run]} as Log]))
		const inferredRoot = inferredSourceRoots.get(run)
		if (inferredRoot) root = {path: inferredRoot, absolute: true}
	}
	if (!root?.absolute) return uri
	const rootSegments = normalizeSegments(root.path)
	if (!rootSegments?.length) return uri
	return getSourcePathFromRoot(uri, rootSegments[rootSegments.length - 1], root.path)
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
		const candidates = artifactSegmentCandidates(artifactLocation.uri, commonAbsoluteRoot, root.name)
		let lastError: unknown
		for (const segments of candidates) {
			try {
				let directory = root
				for (const segment of segments.slice(0, -1)) {
					directory = await directory.getDirectoryHandle(segment)
				}
				const file = await (await directory.getFileHandle(segments[segments.length - 1])).getFile()
				return { name: segments.join('/'), text: await file.text() }
			} catch (error) {
				lastError = error
			}
		}
		if (lastError) throw lastError
		return undefined
	}
}

/**
 * Creates a source reader from files returned by an <input webkitdirectory> control.
 * webkitRelativePath includes the selected directory itself, so remove that first segment.
 */
export function createSelectedFilesSourceFileReader(
	files: File[],
	commonAbsoluteRoot?: string,
): SourceFileReader {
	const filesByPath = new Map<string, File>()
	let selectedRootName: string | undefined
	files.forEach(file => {
		const path = file.webkitRelativePath || file.name
		const segments = normalizeSegments(path)
		if (!segments?.length) return
		const relativeSegments = file.webkitRelativePath ? segments.slice(1) : segments
		if (file.webkitRelativePath && !selectedRootName) selectedRootName = segments[0]
		if (relativeSegments.length) filesByPath.set(relativeSegments.join('/'), file)
	})

	return async (artifactLocation: ArtifactLocation) => {
		if (!artifactLocation.uri) return undefined
		const candidates = artifactSegmentCandidates(artifactLocation.uri, commonAbsoluteRoot, selectedRootName)
		for (const segments of candidates) {
			const file = filesByPath.get(segments.join('/'))
			if (file) return { name: segments.join('/'), text: await file.text() }
		}
		return undefined
	}
}
