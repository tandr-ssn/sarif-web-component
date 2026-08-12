import {ArtifactLocation, PhysicalLocation, Run} from 'sarif'

export interface SourceFile {
	name: string
	text: string
}

export type SourceFileReader = (artifactLocation: ArtifactLocation, run: Run) => Promise<SourceFile | undefined>

const sourceFileCaches = new WeakMap<SourceFileReader, WeakMap<Run, Map<string, Promise<SourceFile | undefined>>>>()

export function getArtifactLocation(ploc: PhysicalLocation | undefined, run: Run): ArtifactLocation | undefined {
	const artifactLocation = ploc?.artifactLocation
	if (!artifactLocation) return undefined
	if (artifactLocation.uri !== undefined) return artifactLocation
	const runArtifactLocation = run.artifacts?.[artifactLocation.index ?? -1]?.location
	return runArtifactLocation ? {...runArtifactLocation, ...artifactLocation} : artifactLocation
}

export function getArtifactContents(artifactLocation: ArtifactLocation | undefined, run: Run): string | undefined {
	if (!artifactLocation) return undefined
	return run.artifacts?.[artifactLocation.index ?? -1]?.contents?.text
}

// uriBaseId is inconsistently included by some producers, while local source resolution
// maps those locations to the same selected-folder path. Group them by URI alone.
export function sourceViewKey(artifactLocation: ArtifactLocation): string | undefined {
	return artifactLocation.uri
}

export async function readSourceFile(
	artifactLocation: ArtifactLocation,
	run: Run,
	reader: SourceFileReader | undefined,
): Promise<SourceFile | undefined> {
	const embeddedText = getArtifactContents(artifactLocation, run)
	if (embeddedText !== undefined) return {name: artifactLocation.uri ?? 'Source file', text: embeddedText}
	if (!reader) return undefined
	const key = sourceViewKey(artifactLocation)
	if (!key) return reader(artifactLocation, run)
	let readerCache = sourceFileCaches.get(reader)
	if (!readerCache) sourceFileCaches.set(reader, readerCache = new WeakMap())
	let runCache = readerCache.get(run)
	if (!runCache) readerCache.set(run, runCache = new Map())
	let sourceFile = runCache.get(key)
	if (!sourceFile) {
		sourceFile = reader(artifactLocation, run)
		runCache.set(key, sourceFile)
	}
	return sourceFile
}
