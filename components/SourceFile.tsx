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

function sourceLines(text: string): string[] {
	return text.match(/[^\n]*\n|[^\n]+$/g) ?? ['']
}

function renderSourceLine(text: string, lineNumber: number, region: Region | undefined): string {
	let contents = escapeHtml(text)
	if (region?.startLine) {
		const startLine = Math.max(1, region.startLine)
		const endLine = Math.max(startLine, region.endLine ?? startLine)
		if (lineNumber >= startLine && lineNumber <= endLine) {
			const startColumn = lineNumber === startLine ? Math.max(0, (region.startColumn ?? 1) - 1) : 0
			const endColumn = lineNumber === endLine
				? region.endColumn === undefined
					? text.replace(/[\r\n]+$/, '').length
					: Math.max(0, region.endColumn - 1)
				: text.length
			const start = Math.min(text.length, startColumn)
			const end = Math.min(text.length, Math.max(start, endColumn))
			if (end > start) {
				contents = escapeHtml(text.slice(0, start))
					+ `<mark>${escapeHtml(text.slice(start, end))}</mark>`
					+ escapeHtml(text.slice(end))
			}
		}
	}
	return `<span class="source-line" data-line="${lineNumber}">${contents}</span>`
}

function renderSourceDocument(target: Window, sourceFile: SourceFile, region: Region | undefined): void {
	const lines = sourceLines(sourceFile.text)
	const lineNumberWidth = String(lines.length).length + 3
	target.document.title = sourceFile.name
	const style = target.document.createElement('style')
	style.textContent = `
		body { margin: 0; }
		pre { margin: 0; padding: 12px 0; tab-size: 4; }
		.source-line::before {
			box-sizing: border-box;
			color: #767676;
			content: attr(data-line);
			display: inline-block;
			margin-right: 12px;
			padding-right: 8px;
			text-align: right;
			user-select: none;
			width: ${lineNumberWidth}ch;
		}
	`
	target.document.head.appendChild(style)
	target.document.body.innerHTML = `<pre>${lines.map((line, index) => renderSourceLine(line, index + 1, region)).join('')}</pre>`
	const mark = target.document.body.querySelector('mark')
	if (mark) setTimeout(() => mark.scrollIntoView?.({ block: 'center' }))
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
