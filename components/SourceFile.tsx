// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import {ArtifactLocation, PhysicalLocation, Region, Run} from 'sarif'

export interface SourceFile {
	name: string
	text: string
}

export type SourceFileReader = (artifactLocation: ArtifactLocation, run: Run) => Promise<SourceFile | undefined>

export const SourceFileReaderContext = React.createContext<SourceFileReader | undefined>(undefined)
export const SourceFileSelectionContext = React.createContext<(() => void) | undefined>(undefined)

export function getArtifactLocation(ploc: PhysicalLocation | undefined, run: Run): ArtifactLocation | undefined {
	const artifactLocation = ploc?.artifactLocation
	if (!artifactLocation) return undefined
	if (artifactLocation.uri !== undefined) return artifactLocation

	const runArtifactLocation = run.artifacts?.[artifactLocation.index ?? -1]?.location
	return runArtifactLocation
		? { ...runArtifactLocation, ...artifactLocation }
		: artifactLocation
}

export function getArtifactContents(artifactLocation: ArtifactLocation | undefined, run: Run): string | undefined {
	if (!artifactLocation) return undefined
	return run.artifacts?.[artifactLocation.index ?? -1]?.contents?.text
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
}

function splitRegion(text: string, region: Region | undefined): [string, string, string] {
	if (!region?.startLine) return ['', '', text]

	const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? ['']
	const startLine = Math.max(0, region.startLine - 1)
	if (startLine >= lines.length) return ['', '', text]

	const endLine = Math.min(lines.length - 1, Math.max(startLine, (region.endLine ?? region.startLine) - 1))
	const startColumn = Math.max(0, (region.startColumn ?? 1) - 1)
	const endColumn = region.endColumn === undefined
		? lines[endLine].replace(/[\r\n]+$/, '').length
		: Math.max(0, region.endColumn - 1)

	const beforeLines = lines.slice(0, startLine).join('')
	const selectedLines = lines.slice(startLine, endLine + 1)
	const afterLines = lines.slice(endLine + 1).join('')
	const before = beforeLines + selectedLines[0].slice(0, startColumn)
	const selected = selectedLines.length === 1
		? selectedLines[0].slice(startColumn, endColumn)
		: selectedLines[0].slice(startColumn)
			+ selectedLines.slice(1, -1).join('')
			+ selectedLines[selectedLines.length - 1].slice(0, endColumn)
	const after = selectedLines[selectedLines.length - 1].slice(endColumn) + afterLines

	return [before, selected, after]
}

function renderSourceDocument(target: Window, sourceFile: SourceFile, region: Region | undefined): void {
	const [before, selected, after] = splitRegion(sourceFile.text, region)
	target.document.title = sourceFile.name
	target.document.body.innerHTML = selected
		? `<pre>${escapeHtml(before)}<mark>${escapeHtml(selected)}</mark>${escapeHtml(after)}</pre>`
		: `<pre>${escapeHtml(after)}</pre>`
	const mark = target.document.body.querySelector('mark')
	if (mark) setTimeout(() => mark.scrollIntoView({ block: 'center' }))
}

export async function openSourceFile(
	artifactLocation: ArtifactLocation,
	run: Run,
	region: Region | undefined,
	reader: SourceFileReader | undefined,
): Promise<void> {
	// Open synchronously during the click event so popup blockers do not reject it after the async read.
	const target = window.open()
	if (!target) return
	target.opener = null
	target.document.title = artifactLocation.uri ?? 'Source file'
	target.document.body.textContent = 'Loading source file...'

	try {
		const embeddedText = getArtifactContents(artifactLocation, run)
		const sourceFile = embeddedText === undefined
			? await reader?.(artifactLocation, run)
			: { name: artifactLocation.uri ?? 'Source file', text: embeddedText }
		if (!sourceFile) {
			target.document.body.textContent = `Unable to read ${artifactLocation.uri ?? 'source file'} from the selected source folder.`
			return
		}
		renderSourceDocument(target, sourceFile, region)
	} catch (error) {
		target.document.body.textContent = `Unable to open source file: ${error instanceof Error ? error.message : String(error)}`
	}
}
