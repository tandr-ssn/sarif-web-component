// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import {ArtifactLocation, PhysicalLocation, Region, Run} from 'sarif'

export interface SourceFile {
	name: string
	text: string
}

export type SourceFileReader = (artifactLocation: ArtifactLocation, run: Run) => Promise<SourceFile | undefined>

export interface SourceTrace {
	locations: Array<PhysicalLocation | undefined>
	activeIndex: number
}

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

interface SourceNavigationTarget {
	id: string
	name: string
}

interface SourceHighlight {
	region: Region
	color: string
	traceIndex?: number
	isStart?: boolean
	isEnd?: boolean
	isActive?: boolean
	previousFile?: SourceNavigationTarget
	nextFile?: SourceNavigationTarget
}

interface SourceFileView {
	id: string
	key: string
	name: string
	sourceFile: SourceFile
	highlights: SourceHighlight[]
}

function selectionOnLine(text: string, lineNumber: number, region: Region): [number, number] | undefined {
	if (!region.startLine) return undefined
	const startLine = Math.max(1, region.startLine)
	const endLine = Math.max(startLine, region.endLine ?? startLine)
	if (lineNumber < startLine || lineNumber > endLine) return undefined

	const startColumn = lineNumber === startLine ? Math.max(0, (region.startColumn ?? 1) - 1) : 0
	const endColumn = lineNumber === endLine
		? region.endColumn === undefined
			? text.replace(/[\r\n]+$/, '').length
			: Math.max(0, region.endColumn - 1)
		: text.length
	const start = Math.min(text.length, startColumn)
	const end = Math.min(text.length, Math.max(start, endColumn))
	return end > start ? [start, end] : undefined
}

function highlightBackground(highlights: SourceHighlight[]): string {
	const colors = Array.from(new Set(highlights.map(highlight => highlight.color)))
	if (colors.length === 1) return `background-color: ${colors[0]}`
	const stops = colors.map((color, index) => {
		const start = Math.round(index * 100 / colors.length)
		const end = Math.round((index + 1) * 100 / colors.length)
		return `${color} ${start}%, ${color} ${end}%`
	})
	return `background: linear-gradient(to bottom, ${stops.join(', ')})`
}

function renderHighlightedText(text: string, lineNumber: number, highlights: SourceHighlight[]): string {
	const selections = highlights
		.map(highlight => ({ highlight, selection: selectionOnLine(text, lineNumber, highlight.region) }))
		.filter(value => value.selection !== undefined) as Array<{ highlight: SourceHighlight, selection: [number, number] }>
	if (!selections.length) return escapeHtml(text)

	const boundaries = Array.from(new Set([0, text.length, ...selections.flatMap(value => value.selection)])).sort((a, b) => a - b)
	return boundaries.slice(0, -1).map((start, index) => {
		const end = boundaries[index + 1]
		const segment = escapeHtml(text.slice(start, end))
		const active = selections.filter(value => value.selection[0] <= start && value.selection[1] >= end)
		const activeClass = active.some(value => value.highlight.isActive) ? ' class="trace-active-highlight"' : ''
		return active.length ? `<mark${activeClass} style="${highlightBackground(active.map(value => value.highlight))}">${segment}</mark>` : segment
	}).join('')
}

function renderTraceBadge(highlight: SourceHighlight): string {
	if (highlight.traceIndex === undefined) return ''
	const classes = [
		'trace-badge',
		highlight.isStart ? 'trace-start' : '',
		highlight.isEnd ? 'trace-end' : '',
		highlight.isActive ? 'trace-active' : '',
	].filter(Boolean).join(' ')
	const position = highlight.isStart && highlight.isEnd ? 'start and end'
		: highlight.isStart ? 'start'
			: highlight.isEnd ? 'end' : undefined
	const title = `Trace entry ${highlight.traceIndex + 1}${position ? ` (${position})` : ''}`
	const previous = highlight.previousFile
		? `<a href="#${highlight.previousFile.id}" title="Previous source file: ${escapeHtml(highlight.previousFile.name)}" aria-label="Previous source file">&#x2190;</a>`
		: ''
	const next = highlight.nextFile
		? `<a href="#${highlight.nextFile.id}" title="Next source file: ${escapeHtml(highlight.nextFile.name)}" aria-label="Next source file">&#x2192;</a>`
		: ''
	return `<span class="${classes}" style="background-color: ${highlight.color}" title="${title}">${previous}<strong>${highlight.traceIndex + 1}</strong>${next}</span>`
}

function renderSourceLine(text: string, lineNumber: number, highlights: SourceHighlight[], showTraceColumn: boolean): string {
	const traceBadges = highlights
		.filter(highlight => highlight.region.startLine === lineNumber && highlight.traceIndex !== undefined)
		.map(renderTraceBadge)
		.join('')
	const traceColumn = showTraceColumn ? `<span class="trace-column">${traceBadges}</span>` : ''
	return `<span class="source-line" data-line="${lineNumber}">${traceColumn}<span class="line-number" data-line="${lineNumber}"></span>${renderHighlightedText(text, lineNumber, highlights)}</span>`
}

function renderSourceDocument(target: Window, views: SourceFileView[], activeKey: string): void {
	const activeView = views.find(view => view.key === activeKey) ?? views[0]
	const showTraceColumn = views.some(view => view.highlights.some(highlight => highlight.traceIndex !== undefined))
	const maxLines = Math.max(...views.map(view => sourceLines(view.sourceFile.text).length))
	const lineNumberWidth = String(maxLines).length + 3
	const maxTraceIndex = Math.max(0, ...views.flatMap(view => view.highlights.map(highlight => highlight.traceIndex ?? 0)))
	const traceIndexWidth = String(maxTraceIndex + 1).length
	const maxBadgesOnLine = Math.max(1, ...views.flatMap(view => {
		const counts = new Map<number, number>()
		view.highlights.forEach(highlight => {
			if (highlight.traceIndex !== undefined && highlight.region.startLine) {
				counts.set(highlight.region.startLine, (counts.get(highlight.region.startLine) ?? 0) + 1)
			}
		})
		return Array.from(counts.values())
	}))
	const traceColumnWidth = Math.max(9, maxBadgesOnLine * (traceIndexWidth + 5) + 1)
	target.document.title = activeView?.name ?? 'Source file'
	const style = target.document.createElement('style')
	style.textContent = `
		body { margin: 0; }
		header { background: #f3f3f3; border-bottom: 1px solid #d0d0d0; font: 14px sans-serif; padding: 8px 12px; position: sticky; top: 0; z-index: 1; }
		pre { margin: 0; padding: 12px 0; tab-size: 4; }
		.source-file { display: none; }
		.source-file:target { display: block; }
		.trace-column {
			display: inline-flex;
			gap: 2px;
			justify-content: flex-end;
			margin-right: 8px;
			vertical-align: middle;
			width: ${traceColumnWidth}ch;
		}
		.trace-badge {
			align-items: center;
			border-radius: 3px;
			box-sizing: border-box;
			color: #202020;
			display: inline-flex;
			gap: 2px;
			justify-content: center;
			min-width: 3ch;
			padding: 0 3px;
		}
		.trace-badge a { color: #202020; font-weight: bold; text-decoration: none; }
		.trace-badge a:hover { text-decoration: underline; }
		.trace-start { border-left: 3px solid #107c10; }
		.trace-end { border-right: 3px solid #c50f1f; }
		.trace-active { box-shadow: 0 0 0 2px #005fb8; }
		.line-number {
			box-sizing: border-box;
			color: #767676;
			display: inline-block;
			margin-right: 12px;
			padding-right: 8px;
			text-align: right;
			user-select: none;
			width: ${lineNumberWidth}ch;
		}
		.line-number::before { content: attr(data-line); }
		mark { color: inherit; }
	`
	target.document.head.appendChild(style)
	target.document.body.innerHTML = views.map(view => {
		const lines = sourceLines(view.sourceFile.text)
		const header = views.length > 1 ? `<header>${escapeHtml(view.name)}</header>` : ''
		return `<section class="source-file" id="${view.id}">${header}<pre>${lines.map((line, index) => renderSourceLine(line, index + 1, view.highlights, showTraceColumn)).join('')}</pre></section>`
	}).join('')
	if (target.location && activeView) target.location.hash = activeView.id
	const activeSection = activeView && target.document.getElementById(activeView.id)
	const mark = activeSection?.querySelector('.trace-active-highlight') ?? activeSection?.querySelector('mark')
	if (mark) setTimeout(() => mark.scrollIntoView?.({ block: 'center' }))
}

function artifactKey(artifactLocation: ArtifactLocation): string | undefined {
	return artifactLocation.uri === undefined ? undefined : `${artifactLocation.uriBaseId ?? ''}\0${artifactLocation.uri}`
}

async function readSourceFile(
	artifactLocation: ArtifactLocation,
	run: Run,
	reader: SourceFileReader | undefined,
): Promise<SourceFile | undefined> {
	const embeddedText = getArtifactContents(artifactLocation, run)
	return embeddedText === undefined
		? reader?.(artifactLocation, run)
		: { name: artifactLocation.uri ?? 'Source file', text: embeddedText }
}

function traceColor(index: number, count: number): string {
	if (count === 1) return 'hsl(210, 75%, 80%)'
	if (index === 0) return 'hsl(130, 55%, 78%)'
	if (index === count - 1) return 'hsl(5, 75%, 82%)'
	return `hsl(${Math.round((index * 137.5) % 360)}, 70%, 82%)`
}

interface ResolvedTraceLocation {
	traceIndex: number
	artifactLocation?: ArtifactLocation
	key?: string
	region?: Region
}

export async function openSourceFile(
	artifactLocation: ArtifactLocation,
	run: Run,
	region: Region | undefined,
	reader: SourceFileReader | undefined,
	trace?: SourceTrace,
): Promise<void> {
	// Open synchronously during the click event so popup blockers do not reject it after the async read.
	const target = window.open()
	if (!target) return
	target.opener = null
	target.document.title = artifactLocation.uri ?? 'Source file'
	target.document.body.textContent = 'Loading source file...'

	try {
		const sourceFile = await readSourceFile(artifactLocation, run, reader)
		if (!sourceFile) {
			target.document.body.textContent = `Unable to read ${artifactLocation.uri ?? 'source file'} from the selected source folder.`
			return
		}

		const activeKey = artifactKey(artifactLocation) ?? 'active-source-file'
		const resolvedTrace: ResolvedTraceLocation[] = trace?.locations.map((physicalLocation, traceIndex) => {
			const resolvedArtifactLocation = getArtifactLocation(physicalLocation, run)
			return {
				traceIndex,
				artifactLocation: resolvedArtifactLocation,
				key: resolvedArtifactLocation && artifactKey(resolvedArtifactLocation),
				region: physicalLocation?.region,
			}
		}) ?? []
		const artifactsByKey = new Map<string, ArtifactLocation>()
		resolvedTrace.forEach(location => {
			if (location.key && location.artifactLocation && !artifactsByKey.has(location.key)) {
				artifactsByKey.set(location.key, location.artifactLocation)
			}
		})
		if (!artifactsByKey.has(activeKey)) artifactsByKey.set(activeKey, artifactLocation)

		const sourceFilesByKey = new Map<string, SourceFile>([[activeKey, sourceFile]])
		await Promise.all(Array.from(artifactsByKey).map(async ([key, location]) => {
			if (key === activeKey) return
			try {
				const traceSourceFile = await readSourceFile(location, run, reader)
				if (traceSourceFile) sourceFilesByKey.set(key, traceSourceFile)
			} catch (_) {
				// A trace may include external or unavailable files; keep the readable local entries.
			}
		}))

		const views: SourceFileView[] = Array.from(artifactsByKey.keys())
			.filter(key => sourceFilesByKey.has(key))
			.map((key, index) => ({
				id: `source-file-${index + 1}`,
				key,
				name: artifactsByKey.get(key)?.uri ?? sourceFilesByKey.get(key).name,
				sourceFile: sourceFilesByKey.get(key),
				highlights: [],
			}))
		const viewsByKey = new Map(views.map(view => [view.key, view] as [string, SourceFileView]))
		const adjacentFile = (traceIndex: number, direction: -1 | 1, currentKey: string): SourceNavigationTarget | undefined => {
			for (let index = traceIndex + direction; index >= 0 && index < resolvedTrace.length; index += direction) {
				const location = resolvedTrace[index]
				const view = location.key && viewsByKey.get(location.key)
				if (view && view.key !== currentKey) return { id: view.id, name: view.name }
			}
			return undefined
		}
		views.forEach(view => {
			view.highlights = resolvedTrace
				.filter(location => location.key === view.key && location.region?.startLine)
				.map(location => ({
					region: location.region,
					traceIndex: location.traceIndex,
					color: traceColor(location.traceIndex, resolvedTrace.length),
					isStart: location.traceIndex === 0,
					isEnd: location.traceIndex === resolvedTrace.length - 1,
					isActive: location.traceIndex === trace?.activeIndex,
					previousFile: adjacentFile(location.traceIndex, -1, view.key),
					nextFile: adjacentFile(location.traceIndex, 1, view.key),
				}))
		})
		const activeView = viewsByKey.get(activeKey)
		if (region?.startLine && activeView && !activeView.highlights.length) {
			activeView.highlights.push({ region, color: 'hsl(55, 90%, 75%)' })
		}
		renderSourceDocument(target, views, activeKey)
	} catch (error) {
		target.document.body.textContent = `Unable to open source file: ${error instanceof Error ? error.message : String(error)}`
	}
}
