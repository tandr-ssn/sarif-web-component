// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import {ArtifactLocation, PhysicalLocation, Region, Run, ThreadFlowLocation} from 'sarif'
import {highlightSourceSegment} from './SyntaxHighlight'
import {AcahTraceRole, getTraceStepAcah, getTraceStepRole} from './Acah'
import {installTooltips} from './Tooltip'
import {escapeSourceHtml as escapeHtml, sourceDocumentTitle, sourceLines} from './SourceHtml'
import {getArtifactContents, getArtifactLocation, readSourceFile, SourceFile, SourceFileReader, sourceViewKey} from './SourceFileResolver'
import {stableSha256} from './StableHash'
export {getArtifactContents, getArtifactLocation, SourceFile, SourceFileReader} from './SourceFileResolver'

export interface SourceTrace {
	locations: Array<PhysicalLocation | undefined>
	activeIndex: number
	label?: string
	steps?: Array<ThreadFlowLocation | undefined>
	identifierHints?: Array<string | undefined>
	inferIdentifiers?: boolean
	origin?: {
		location: PhysicalLocation
		name?: string
		kind?: string
	}
}

export interface SourceFindingNavigation {
	id: string
	label: string
	run: Run
	runIndex: number
	location: PhysicalLocation
	trace?: SourceTrace
}

export interface SourceNavigation {
	reportId: string
	byFile: Map<string, SourceFindingNavigation[]>
	byLocation: WeakMap<object, SourceFindingNavigation>
}

export const SourceFileReaderContext = React.createContext<SourceFileReader | undefined>(undefined)
export const SourceFileSelectionContext = React.createContext<(() => void) | undefined>(undefined)
export type SourcePathFormatter = (uri: string, run?: Run, artifactLocation?: ArtifactLocation) => string
export const SourcePathFormatterContext = React.createContext<SourcePathFormatter | undefined>(undefined)
export const SourceNavigationContext = React.createContext<SourceNavigation | undefined>(undefined)

function fragmentHref(id: string): string {
	return `#${encodeURIComponent(id).replace(/%2F/gi, '/')}`
}

interface SourceNavigationTarget {
	id: string
	name: string
	traceIndex: number
}

interface SourceHighlight {
	region: Region
	color: string
	isIdentifier?: boolean
	traceIndex?: number
	isStart?: boolean
	isEnd?: boolean
	role?: AcahTraceRole
	isActive?: boolean
	previousEntry?: SourceNavigationTarget
	nextEntry?: SourceNavigationTarget
	tooltip?: string
}

interface SourceFileView {
	id: string
	key: string
	name: string
	sourceFile: SourceFile
	highlights: SourceHighlight[]
	findingMarkers: SourceFindingNavigation[]
}

interface MissingTraceLocation {
	traceIndex: number
	name: string
}

interface SourceTraceSummary {
	label: string
	totalEntries: number
	readableEntries: number
	activeIndex: number
	missing: MissingTraceLocation[]
	roles?: Array<AcahTraceRole | undefined>
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

function readableSelectionOnLine(text: string, lineNumber: number, region: Region): [number, number] | undefined {
	const selection = selectionOnLine(text, lineNumber, region)
	if (!selection || (region.endLine ?? region.startLine) !== region.startLine) return selection
	const selected = text.slice(selection[0], selection[1])
	if (/[A-Za-z0-9_$]/.test(selected)) return selection

	const contentEnd = text.replace(/[\r\n]+$/, '').length
	const contentStart = text.slice(0, contentEnd).search(/\S/)
	return contentStart >= 0 && contentEnd > contentStart ? [contentStart, contentEnd] : selection
}

function highlightColor(highlights: SourceHighlight[]): string {
	const highlight = highlights.find(candidate => candidate.isActive) ?? highlights[0]
	return highlight.color
}

function renderSyntaxSegment(text: string, fileName: string): string {
	const lineEnding = text.match(/[\r\n]+$/)?.[0] ?? ''
	const code = lineEnding ? text.slice(0, -lineEnding.length) : text
	const highlighted = highlightSourceSegment(code, fileName)
	return highlighted === undefined ? escapeHtml(text) : highlighted + escapeHtml(lineEnding)
}

function renderHighlightedText(text: string, lineNumber: number, highlights: SourceHighlight[], fileName: string): string {
	const selections = highlights
		.map(highlight => ({ highlight, selection: readableSelectionOnLine(text, lineNumber, highlight.region) }))
		.filter(value => value.selection !== undefined) as Array<{ highlight: SourceHighlight, selection: [number, number] }>
	if (!selections.length) return renderSyntaxSegment(text, fileName)

	const boundaries = Array.from(new Set([0, text.length, ...selections.flatMap(value => value.selection)])).sort((a, b) => a - b)
	return boundaries.slice(0, -1).map((start, index) => {
		const end = boundaries[index + 1]
		const segment = renderSyntaxSegment(text.slice(start, end), fileName)
		const active = selections.filter(value => value.selection[0] <= start && value.selection[1] >= end)
		if (!active.length) return segment
		const identifierHighlights = active.filter(value => value.highlight.isIdentifier)
		const locationHighlights = active.filter(value => !value.highlight.isIdentifier)
		const colorHighlights = locationHighlights.length ? locationHighlights : identifierHighlights
		const identifierClass = identifierHighlights.length ? ' trace-identifier-highlight' : ''
		const locationClass = locationHighlights.length ? ' trace-location-highlight' : ''
		const traceIndices = active
			.map(value => value.highlight.traceIndex)
			.filter(index => index !== undefined)
			.join(' ')
		const traceData = traceIndices ? ` data-trace-indices="${traceIndices}"` : ''
		const locationTraceIndices = locationHighlights
			.map(value => value.highlight.traceIndex)
			.filter(index => index !== undefined)
			.join(' ')
		const locationTraceData = locationTraceIndices ? ` data-location-trace-indices="${locationTraceIndices}"` : ''
		const locationTraceColors = locationHighlights
			.filter(value => value.highlight.traceIndex !== undefined)
			.map(value => `${value.highlight.traceIndex}:${value.highlight.color}`)
			.join(' ')
		const locationColorData = locationTraceColors ? ` data-location-trace-colors="${locationTraceColors}"` : ''
		const backgroundColor = highlightColor(colorHighlights.map(value => value.highlight))
		const identifierStyle = identifierHighlights.length && locationHighlights.length
			? `; --trace-identifier-color: ${identifierHighlights[0].highlight.color}`
			: ''
		const tooltip = Array.from(new Set(active.map(value => value.highlight.tooltip).filter(Boolean))).join('\n\n')
		const tooltipData = tooltip ? ` data-swc-tooltip="${escapeHtml(tooltip)}"` : ''
		return `<mark class="trace-highlight${identifierClass}${locationClass}"${traceData}${locationTraceData}${locationColorData}${tooltipData} data-default-highlight-color="${backgroundColor}" style="background-color: ${backgroundColor}${identifierStyle}">${segment}</mark>`
	}).join('')
}

function renderTraceBadge(highlight: SourceHighlight): string {
	if (highlight.traceIndex === undefined) return ''
	const classes = [
		'trace-badge',
		highlight.role ? `trace-${highlight.role}` : '',
		highlight.isStart ? 'trace-start' : '',
		highlight.isEnd ? 'trace-end' : '',
		highlight.isActive ? 'trace-active' : '',
	].filter(Boolean).join(' ')
	const position = highlight.isStart && highlight.isEnd ? 'start and end'
		: highlight.isStart ? 'start'
			: highlight.isEnd ? 'end' : undefined
	const title = highlight.tooltip ?? `Trace entry ${highlight.traceIndex + 1}${position ? ` (${position})` : ''}`
	const previous = highlight.previousEntry
		? `<a class="trace-previous" href="${escapeHtml(fragmentHref(highlight.previousEntry.id))}" data-activate-trace="${highlight.previousEntry.traceIndex}" data-swc-tooltip="Previous trace entry: ${escapeHtml(highlight.previousEntry.name)}" aria-label="Previous trace entry">&#x2190;</a>`
		: ''
	const next = highlight.nextEntry
		? `<a class="trace-next" href="${escapeHtml(fragmentHref(highlight.nextEntry.id))}" data-activate-trace="${highlight.nextEntry.traceIndex}" data-swc-tooltip="Next trace entry: ${escapeHtml(highlight.nextEntry.name)}" aria-label="Next trace entry">&#x2192;</a>`
		: ''
	const sourceColumn = highlight.region.startColumn ? ` data-source-column="${highlight.region.startColumn}"` : ''
	return `<span class="${classes}" data-trace-index="${highlight.traceIndex}"${sourceColumn} data-swc-tooltip="${escapeHtml(title)}" style="background-color: ${highlight.color}">${previous}<button type="button" data-activate-trace="${highlight.traceIndex}" aria-label="Focus trace entry ${highlight.traceIndex + 1}. ${escapeHtml(title)}">${highlight.traceIndex + 1}</button>${next}</span>`
}

function renderSourceLine(text: string, lineNumber: number, highlights: SourceHighlight[], findingMarkers: SourceFindingNavigation[], showTraceColumn: boolean, fileName: string, activeFindingId?: string): string {
	const traceBadges = highlights
		.filter(highlight => highlight.region.startLine === lineNumber && highlight.traceIndex !== undefined)
		.filter((highlight, index, lineHighlights) => lineHighlights.findIndex(candidate => candidate.traceIndex === highlight.traceIndex) === index)
		.sort((left, right) =>
			(left.region.startColumn ?? 1) - (right.region.startColumn ?? 1)
			|| (left.region.endColumn ?? Number.MAX_SAFE_INTEGER) - (right.region.endColumn ?? Number.MAX_SAFE_INTEGER)
			|| left.traceIndex - right.traceIndex)
		.map(renderTraceBadge)
		.join('')
	const findingBadges = findingMarkers
		.filter(finding => finding.location.region?.startLine === lineNumber)
		.map(finding => `<button type="button" class="finding-marker${finding.id === activeFindingId ? ' finding-marker-active' : ''}" data-finding-id="${escapeHtml(finding.id)}" data-swc-tooltip="${escapeHtml(finding.label)}" aria-label="Open finding: ${escapeHtml(finding.label)}"></button>`)
		.join('')
	const traceColumn = showTraceColumn ? `<span class="trace-column">${traceBadges}</span>` : ''
	const findingGutter = findingBadges ? `<span class="finding-markers">${findingBadges}</span>` : ''
	return `<span class="source-line" data-line="${lineNumber}">${traceColumn}<span class="line-number" data-line="${lineNumber}">${findingGutter}</span>${renderHighlightedText(text, lineNumber, highlights, fileName)}</span>`
}

function renderSourceToolbar(views: SourceFileView[], activeView: SourceFileView, trace?: SourceTraceSummary, findings: SourceFindingNavigation[] = [], activeFindingId?: string): string {
	const activeFileIndex = Math.max(0, views.indexOf(activeView))
	const activeHighlight = activeView.highlights.find(highlight => highlight.traceIndex === trace?.activeIndex)
		?? activeView.highlights[0]
	const activeLine = activeHighlight?.region.startLine ?? 1
	const activeColumn = activeHighlight?.region.startColumn
	const activeLocation = `${activeView.name}:${activeLine}${activeColumn ? `:${activeColumn}` : ''}`
	const semanticRoles = new Set(trace?.roles?.filter(Boolean) ?? [])
	const traceLegend = semanticRoles.size
		? `${semanticRoles.has('source') ? '<span class="legend-swatch legend-source"></span>Source' : ''}
			${semanticRoles.has('boundary') ? '<span class="legend-swatch legend-boundary"></span>Boundary' : ''}
			<span class="legend-swatch legend-active"></span>Active
			${semanticRoles.has('sink') ? '<span class="legend-swatch legend-sink"></span>Sink' : ''}`
		: '<span class="legend-swatch legend-start"></span>Start\n<span class="legend-swatch legend-active"></span>Active\n<span class="legend-swatch legend-end"></span>End'
	const traceNavigation = trace ? `
		<strong>${escapeHtml(trace.label)}</strong>
		<button type="button" data-trace-action="previous" data-swc-tooltip="Previous readable trace entry ([)">&#x2190; Previous</button>
		<span data-trace-position>Entry ${trace.activeIndex + 1} of ${trace.totalEntries} &middot; File ${activeFileIndex + 1} of ${views.length}</span>
		<button type="button" data-trace-action="next" data-swc-tooltip="Next readable trace entry (])">Next &#x2192;</button>
		<span class="trace-legend" aria-label="Trace color legend">
			${traceLegend}
		</span>` : ''
	const missing = trace?.missing.length ? `<details class="trace-missing">
		<summary>${trace.readableEntries} of ${trace.totalEntries} trace locations readable</summary>
		<ol>${trace.missing.map(location => `<li data-trace-index="${location.traceIndex}">${location.traceIndex + 1}. ${escapeHtml(location.name)}</li>`).join('')}</ol>
	</details>` : ''
	const findingNavigation = findings.length ? `<label class="finding-navigation">
		<select data-finding-navigation aria-label="Finding in this file">${findings.map((finding, index) => {
			const line = finding.location.region?.startLine
			const selected = finding.id === activeFindingId ? ' selected' : ''
			return `<option value="${escapeHtml(finding.id)}"${selected}>${index + 1}. ${escapeHtml(finding.label)}${line ? ` (line ${line})` : ''}</option>`
		}).join('')}</select>
	</label>` : ''
	return `<div class="source-toolbar" data-active-line="${activeLine}"${activeColumn ? ` data-active-column="${activeColumn}"` : ''} data-file-count="${views.length}" data-trace-count="${trace?.totalEntries ?? 0}">
		<div class="source-path" data-current-file>${escapeHtml(activeLocation)}</div>
		<div class="source-toolbar-row">
			${findings.length ? '<button type="button" data-source-back>&#x2190; Findings</button>' : ''}
			${findingNavigation}
			${traceNavigation}
			<span class="source-actions">
				<button type="button" data-copy="path">Copy path</button>
				<button type="button" data-copy="path-line">Copy path:line</button>
				${trace ? '<button type="button" data-copy="trace">Copy trace</button>' : ''}
			</span>
			<span class="copy-status" data-copy-status role="status" aria-live="polite"></span>
		</div>
		${missing}
	</div>`
}

function wireSourceDocument(target: Window, trace: SourceTraceSummary | undefined, activeView: SourceFileView, findings: SourceFindingNavigation[], activeFindingId?: string, onNavigateFinding?: (finding: SourceFindingNavigation) => void): void {
	const document = target.document
	installTooltips(target)
	const toolbar = document.querySelector('.source-toolbar') as HTMLElement
	const traceIndices = Array.from(document.querySelectorAll('.trace-badge[data-trace-index]'))
		.map(badge => +(badge.getAttribute('data-trace-index') ?? -1))
		.filter((index, position, indices) => index >= 0 && indices.indexOf(index) === position)
		.sort((a, b) => a - b)
	let activeTraceIndex = trace?.activeIndex
	let activeFileId = activeView.id

	const traceBadge = (index: number) => document.querySelector(`.trace-badge[data-trace-index="${index}"]`) as HTMLElement | null
	const setButtonDisabled = (action: string, disabled: boolean) => {
		const button = document.querySelector(`[data-trace-action="${action}"]`) as HTMLButtonElement | null
		if (button) button.disabled = disabled
	}
	const activateTrace = (index: number, scroll: boolean) => {
		const badge = traceBadge(index)
		const line = badge?.closest('.source-line') as HTMLElement | null
		const section = badge?.closest('.source-file') as HTMLElement | null
		if (!badge || !line || !section) return
		activeTraceIndex = index
		activeFileId = section.id
		document.querySelectorAll('.trace-active').forEach(element => element.classList.remove('trace-active'))
		document.querySelectorAll('.trace-active-highlight, .trace-active-highlight-start, .trace-active-highlight-end')
			.forEach(element => element.classList.remove('trace-active-highlight', 'trace-active-highlight-start', 'trace-active-highlight-end'))
		document.querySelectorAll<HTMLElement>('mark[data-default-highlight-color]').forEach(mark => {
			mark.style.backgroundColor = mark.dataset.defaultHighlightColor ?? ''
		})
		badge.classList.add('trace-active')
		let activeMarks = Array.from(document.querySelectorAll<HTMLElement>(`mark[data-location-trace-indices~="${index}"]`))
		if (!activeMarks.length) activeMarks = Array.from(document.querySelectorAll<HTMLElement>(`mark[data-trace-indices~="${index}"]`))
		const marksByLine = new Map<Element, Element[]>()
		activeMarks.forEach(mark => {
			const selectedColor = mark.dataset.locationTraceColors?.split(' ')
				.find(value => value.startsWith(`${index}:`))?.slice(String(index).length + 1)
			if (selectedColor) mark.style.backgroundColor = selectedColor
			mark.classList.add('trace-active-highlight')
			const line = mark.closest('.source-line')
			if (!line) return
			const lineMarks = marksByLine.get(line) ?? []
			lineMarks.push(mark)
			marksByLine.set(line, lineMarks)
		})
		marksByLine.forEach(lineMarks => {
			lineMarks[0]?.classList.add('trace-active-highlight-start')
			lineMarks[lineMarks.length - 1]?.classList.add('trace-active-highlight-end')
		})
		if (target.location) target.location.hash = fragmentHref(section.id)
		const fileName = section.getAttribute('data-file-name') ?? 'Source file'
		const lineNumber = line.getAttribute('data-line') ?? '1'
		toolbar.setAttribute('data-active-line', lineNumber)
		const columnNumber = badge.getAttribute('data-source-column')
		if (columnNumber) toolbar.setAttribute('data-active-column', columnNumber)
		else toolbar.removeAttribute('data-active-column')
		const currentFile = document.querySelector('[data-current-file]')
		if (currentFile) currentFile.textContent = `${fileName}:${lineNumber}${columnNumber ? `:${columnNumber}` : ''}`
		const position = document.querySelector('[data-trace-position]')
		if (position && trace) {
			position.textContent = `Entry ${index + 1} of ${trace.totalEntries} · File ${+(section.getAttribute('data-file-index') ?? 0) + 1} of ${toolbar.getAttribute('data-file-count')}`
		}
		target.document.title = sourceDocumentTitle(fileName, findings.find(finding => finding.id === activeFindingId)?.label)
		const navigablePosition = traceIndices.indexOf(index)
		setButtonDisabled('previous', navigablePosition <= 0)
		setButtonDisabled('next', navigablePosition < 0 || navigablePosition >= traceIndices.length - 1)
		if (scroll) line.scrollIntoView?.({ block: 'center' })
	}
	const moveTrace = (direction: -1 | 1) => {
		if (activeTraceIndex === undefined) return
		const position = traceIndices.indexOf(activeTraceIndex)
		const nextIndex = traceIndices[position + direction]
		if (nextIndex !== undefined) activateTrace(nextIndex, true)
	}
	const activeSection = document.getElementById(activeView.id) as HTMLElement | null
	const activePathAndLine = (): [string, string] => {
		const section = document.getElementById(activeFileId) as HTMLElement | null ?? activeSection
		const path = section?.getAttribute('data-file-name') ?? activeView.name
		return [path, toolbar.getAttribute('data-active-line') ?? '1']
	}
	const copyText = async (value: string) => {
		try {
			if (target.navigator?.clipboard?.writeText) {
				await target.navigator.clipboard.writeText(value)
			} else {
				const textarea = document.createElement('textarea')
				textarea.value = value
				document.body.appendChild(textarea)
				textarea.select()
				document.execCommand?.('copy')
				textarea.remove()
			}
			const status = document.querySelector('[data-copy-status]')
			if (status) status.textContent = 'Copied'
		} catch (error) {
			const status = document.querySelector('[data-copy-status]')
			if (status) status.textContent = `Copy failed: ${error instanceof Error ? error.message : String(error)}`
		}
	}
	const traceSummaryText = (): string => {
		if (!trace) return ''
		const entries = Array.from({ length: trace.totalEntries }, (_, index) => {
			const badge = traceBadge(index)
			const line = badge?.closest('.source-line')
			const section = badge?.closest('.source-file')
			if (badge && line && section) {
				return `${index + 1}. ${section.getAttribute('data-file-name')}:${line.getAttribute('data-line')}`
			}
			const missing = trace.missing.find(location => location.traceIndex === index)
			return `${index + 1}. unavailable${missing ? `: ${missing.name}` : ''}`
		})
		return [trace.label, ...entries].join('\n')
	}

	document.addEventListener('click', event => {
		const element = event.target as HTMLElement | null
		const findingId = element?.closest('[data-finding-id]')?.getAttribute('data-finding-id')
		if (findingId) {
			event.preventDefault()
			const finding = findings.find(candidate => candidate.id === findingId)
			if (finding) onNavigateFinding?.(finding)
			return
		}
		if (element?.closest('[data-source-back]')) {
			event.preventDefault()
			target.opener?.focus?.()
			target.close?.()
			return
		}
		const highlight = element?.closest('.trace-highlight') as HTMLElement | null
		if (highlight) {
			const rawIndices = highlight.getAttribute('data-location-trace-indices')
				?? highlight.getAttribute('data-trace-indices')
			const indices = rawIndices ? rawIndices.split(' ').map(Number).filter(Number.isFinite) : []
			const index = activeTraceIndex !== undefined && indices.includes(activeTraceIndex)
				? activeTraceIndex
				: indices[0]
			if (index !== undefined) {
				event.preventDefault()
				activateTrace(index, true)
				return
			}
		}
		const activation = element?.closest('[data-activate-trace]') as HTMLElement | null
		if (activation) {
			event.preventDefault()
			activateTrace(+(activation.getAttribute('data-activate-trace') ?? -1), true)
			// Preserve focus visibility for keyboard activation, but do not let a mouse click
			// keep this badge's hover-only arrows pinned open through :focus-within.
			if (event.detail > 0) activation.blur()
			return
		}
		const action = element?.closest('[data-trace-action]')?.getAttribute('data-trace-action')
		if (action === 'previous') moveTrace(-1)
		if (action === 'next') moveTrace(1)
	})
	const findingSelect = document.querySelector('[data-finding-navigation]') as HTMLSelectElement | null
	if (findingSelect) findingSelect.onchange = () => {
		const finding = findings.find(candidate => candidate.id === findingSelect.value)
		if (finding) onNavigateFinding?.(finding)
	}
	document.querySelectorAll('[data-copy]').forEach(button => (button as HTMLElement).onclick = () => {
		const status = document.querySelector('[data-copy-status]')
		if (status) status.textContent = 'Copying...'
		try {
			const copy = button.getAttribute('data-copy')
			const [path, line] = activePathAndLine()
			void copyText(copy === 'path' ? path : copy === 'path-line' ? `${path}:${line}` : traceSummaryText())
		} catch (error) {
			if (status) status.textContent = `Copy failed: ${error instanceof Error ? error.message : String(error)}`
		}
	})
	document.addEventListener('keydown', event => {
		if (event.altKey || event.ctrlKey || event.metaKey) return
		if (event.key === '[') {
			event.preventDefault()
			moveTrace(-1)
		}
		if (event.key === ']') {
			event.preventDefault()
			moveTrace(1)
		}
	})

	if (activeTraceIndex !== undefined && traceBadge(activeTraceIndex)) {
		activateTrace(activeTraceIndex, false)
	} else if (target.location && activeSection) {
		target.location.hash = fragmentHref(activeSection.id)
	}
}

function renderSourceDocument(target: Window, views: SourceFileView[], activeKey: string, trace?: SourceTraceSummary, findings: SourceFindingNavigation[] = [], activeFindingId?: string, onNavigateFinding?: (finding: SourceFindingNavigation) => void): void {
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
	const maxBadgesPerRow = 4
	const badgesPerRow = Math.min(maxBadgesPerRow, maxBadgesOnLine)
	const traceColumnWidth = Math.max(9, badgesPerRow * (traceIndexWidth + 3) + 1)
	const activeFinding = findings.find(finding => finding.id === activeFindingId)
	target.document.title = sourceDocumentTitle(activeView?.name, activeFinding?.label)
	const style = target.document.createElement('style')
	style.setAttribute('data-source-style', '')
	style.textContent = `
		:root { color-scheme: light dark; }
		body { background: #ffffff; color: #202020; font-family: "Segoe UI", "-apple-system", BlinkMacSystemFont, Roboto, "Helvetica Neue", Helvetica, Ubuntu, Arial, sans-serif; font-size: 14px; margin: 0; }
		button { font: inherit; }
		.source-toolbar { background: #f3f3f3; border-bottom: 1px solid #d0d0d0; padding: 7px 10px; position: sticky; top: 0; z-index: 10; }
		.source-toolbar-row { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; }
		.source-toolbar button { background: #ffffff; border: 1px solid #b3b3b3; border-radius: 2px; color: #202020; cursor: pointer; font-weight: 400; padding: 6px 12px; }
		.source-toolbar button:disabled { cursor: default; opacity: .45; }
		.source-path { font-weight: 400; margin-bottom: 6px; overflow-wrap: anywhere; }
		.source-actions { display: inline-flex; gap: 4px; }
		.finding-navigation { align-items: center; display: inline-flex; gap: 6px; }
		.finding-navigation select { font: inherit; max-width: min(42vw, 44em); padding: 5px 7px; }
		.copy-status { min-width: 4em; }
		.trace-legend { align-items: center; display: inline-flex; gap: 4px; white-space: nowrap; }
		.legend-swatch { border-radius: 2px; display: inline-block; height: 12px; width: 12px; }
		.legend-start { background: #c7e9c0; border-left: 4px solid #107c10; }
		.legend-source { background: #c7e9c0; border-left: 4px solid #107c10; }
		.legend-boundary { background: #f7ee9f; border-left: 4px solid #8a6d1d; }
		.legend-active { background: #bde3f4; box-shadow: 0 0 0 2px #005fb8; }
		.legend-end { background: #f5b5b0; border-right: 4px solid #c50f1f; }
		.legend-sink { background: #f5b5b0; border-right: 4px solid #c50f1f; }
		.trace-missing { margin-top: 6px; }
		.trace-missing ol { margin: 5px 0 0; max-height: 8em; overflow: auto; }
		pre { font-size: 12pt; margin: 0; padding: 12px 0; tab-size: 4; }
		.source-file { display: none; }
		.source-file:target { display: block; }
		.trace-column {
			display: inline-flex;
			flex-wrap: wrap;
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
			position: relative;
		}
		.trace-badge:hover, .trace-badge:focus-within { z-index: 2; }
		.trace-badge a {
			align-items: center;
			background-color: inherit;
			border: 1px solid rgb(32 32 32 / 45%);
			border-radius: 3px;
			box-sizing: border-box;
			color: #202020;
			display: inline-flex;
			font-size: 1.35em;
			font-weight: bold;
			height: calc(100% + 2px);
			justify-content: center;
			line-height: .8;
			min-width: 2ch;
			opacity: 0;
			pointer-events: none;
			position: absolute;
			text-decoration: none;
			top: 50%;
			transform: translateY(-50%);
			z-index: 3;
		}
		.trace-badge:hover > a, .trace-badge:focus-within > a { opacity: 1; pointer-events: auto; }
		.trace-badge > .trace-previous { right: calc(100% - 1px); }
		.trace-badge > .trace-next { left: calc(100% - 1px); }
		.trace-badge a:hover { text-decoration: underline; }
		.trace-badge button { background: transparent; border: 0; color: #202020; cursor: pointer; font-weight: bold; margin: 0; padding: 0; }
		.finding-markers { bottom: 0; display: flex; gap: 2px; left: 0; position: absolute; top: 0; }
		.finding-marker { background: #767676; border: 0; border-radius: 1px; cursor: pointer; height: 100%; margin: 0; padding: 0; width: 3px; }
		.finding-marker:hover, .finding-marker:focus-visible { background: #005fb8; box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #005fb8; }
		.finding-marker-active { background: #005fb8; }
		.trace-start { border-left: 4px solid #107c10; }
		.trace-end { border-right: 4px solid #c50f1f; }
		.trace-source { border-left: 4px solid #107c10; }
		.trace-boundary { border-left: 4px solid #8a6d1d; }
		.trace-sink { border-right: 4px solid #c50f1f; }
		.trace-active { box-shadow: 0 0 0 2px #005fb8; }
		.trace-active-highlight {
			border-radius: 0;
			box-shadow: 0 -2px 0 #005fb8, 0 2px 0 #005fb8;
			position: relative;
		}
		.trace-active-highlight-start { border-radius: 2px 0 0 2px; }
		.trace-active-highlight-end { border-radius: 0 2px 2px 0; }
		.trace-active-highlight-start::before, .trace-active-highlight-end::after {
			background: #005fb8;
			bottom: -2px;
			content: '';
			position: absolute;
			top: -2px;
			width: 2px;
		}
		.trace-active-highlight-start::before { left: -3px; }
		.trace-active-highlight-end::after { right: -3px; }
		.trace-location-highlight.trace-identifier-highlight {
			text-decoration-color: var(--trace-identifier-color);
			text-decoration-line: underline;
			text-decoration-thickness: 2px;
			text-underline-offset: 2px;
		}
		.trace-highlight[data-trace-indices] { cursor: pointer; }
		.line-number {
			box-sizing: border-box;
			color: #767676;
			display: inline-block;
			margin-right: 12px;
			padding-left: 8px;
			padding-right: 8px;
			position: relative;
			text-align: right;
			user-select: none;
			width: ${lineNumberWidth}ch;
		}
		.line-number::before { content: attr(data-line); }
		mark { color: #111111; }
		.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section, .hljs-link { color: #0000a0; font-weight: bold; }
		.hljs-string, .hljs-attr, .hljs-template-variable { color: #a31515; }
		.hljs-comment, .hljs-quote { color: #5f6f5f; font-style: italic; }
		.hljs-number, .hljs-symbol, .hljs-bullet { color: #098658; }
		.hljs-title, .hljs-type, .hljs-built_in { color: #267f99; }
		.hljs-meta { color: #795e26; }
		@media (prefers-color-scheme: dark) {
			body { background: #1e1e1e; color: #dddddd; }
			.source-toolbar { background: #292929; border-color: #4a4a4a; }
			.source-toolbar button { background: #383838; border-color: #666666; color: #f0f0f0; }
			.line-number { color: #a0a0a0; }
			.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section, .hljs-link { color: #569cd6; }
			.hljs-string, .hljs-attr, .hljs-template-variable { color: #ce9178; }
			.hljs-comment, .hljs-quote { color: #6a9955; }
			.hljs-number, .hljs-symbol, .hljs-bullet { color: #b5cea8; }
			.hljs-title, .hljs-type, .hljs-built_in { color: #4ec9b0; }
			.hljs-meta { color: #dcdcaa; }
			.trace-highlight .hljs-keyword, .trace-highlight .hljs-selector-tag, .trace-highlight .hljs-literal, .trace-highlight .hljs-section, .trace-highlight .hljs-link { color: #0000a0; }
			.trace-highlight .hljs-string, .trace-highlight .hljs-attr, .trace-highlight .hljs-template-variable { color: #a31515; }
			.trace-highlight .hljs-comment, .trace-highlight .hljs-quote { color: #405540; }
			.trace-highlight .hljs-number, .trace-highlight .hljs-symbol, .trace-highlight .hljs-bullet { color: #075f40; }
			.trace-highlight .hljs-title, .trace-highlight .hljs-type, .trace-highlight .hljs-built_in { color: #155f75; }
			.trace-highlight .hljs-meta { color: #654910; }
		}
	`
	target.document.querySelectorAll('style[data-source-style]').forEach(element => element.remove())
	target.document.head.appendChild(style)
	target.document.body.innerHTML = renderSourceToolbar(views, activeView, trace, findings, activeFindingId) + views.map((view, fileIndex) => {
		const lines = sourceLines(view.sourceFile.text)
		return `<section class="source-file" id="${view.id}" data-file-index="${fileIndex}" data-file-name="${escapeHtml(view.name)}"><pre>${lines.map((line, index) => renderSourceLine(line, index + 1, view.highlights, view.findingMarkers, showTraceColumn, view.name, activeFindingId)).join('')}</pre></section>`
	}).join('')
	if (activeView) wireSourceDocument(target, trace, activeView, findings, activeFindingId, onNavigateFinding)
	const activeSection = activeView && target.document.getElementById(activeView.id)
	const mark = activeSection?.querySelector('.trace-active-highlight') ?? activeSection?.querySelector('mark')
	if (mark) setTimeout(() => mark.scrollIntoView?.({ block: 'center' }))
}

export function traceColor(index: number, count: number, role?: AcahTraceRole): string {
	const accessiblePalette = ['#bde3f4', '#f6d39b', '#e8bad7', '#a8dbc9', '#f7ee9f', '#aecce5', '#d8c4eb']
	if (role === 'source') return '#c7e9c0'
	if (role === 'boundary') return '#f7ee9f'
	if (role === 'sink') return '#f5b5b0'
	if (role === 'propagation') return accessiblePalette[index % accessiblePalette.length]
	if (count === 1) return '#bde3f4'
	if (index === 0) return '#c7e9c0'
	if (index === count - 1) return '#f5b5b0'
	return accessiblePalette[index % accessiblePalette.length]
}

interface ResolvedTraceLocation {
	traceIndex: number
	artifactLocation?: ArtifactLocation
	key?: string
	region?: Region
	identifierHint?: string
	step?: ThreadFlowLocation
	role?: AcahTraceRole
	tooltip?: string
}

interface ResolvedTraceOrigin {
	location: PhysicalLocation
	artifactLocation?: ArtifactLocation
	key?: string
	region?: Region
	name?: string
	kind?: string
}

function multiformatText(message: any): string | undefined {
	return message?.text ?? message?.markdown
}

function readableName(value: string): string {
	const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
	return words ? words[0].toUpperCase() + words.slice(1) : words
}

function traceStepRole(step: ThreadFlowLocation | undefined, index: number, count: number): string | undefined {
	const kinds = step?.kinds?.map(kind => kind.toLowerCase()) ?? []
	if (kinds.includes('analysisboundary')) return 'Boundary'
	if (kinds.includes('source')) return 'Source'
	if (kinds.includes('sink')) return 'Sink'
	if (kinds.includes('passthrough')) return 'Propagation'
	if (index === 0) return 'Start'
	if (index === count - 1) return 'End'
	return undefined
}

function resolvedTraceLocationText(location: ResolvedTraceLocation, run: Run, formatPath?: SourcePathFormatter): string | undefined {
	const uri = location.artifactLocation?.uri
	const path = uri && (formatPath?.(uri, run, location.artifactLocation) ?? uri)
	const line = location.region?.startLine
	const column = location.region?.startColumn
	if (!path) return line ? `Line ${line}${column ? `:${column}` : ''}` : undefined
	return line ? `${path}:${line}${column ? `:${column}` : ''}` : path
}

function traceLocationTooltip(location: ResolvedTraceLocation, count: number, run: Run, formatPath?: SourcePathFormatter): string {
	const step = location.step
	const acah = getTraceStepAcah(step, run)
	const role = getTraceStepRole(step, run) ?? traceStepRole(step, location.traceIndex, count)
	const roleLabel = role && readableName(role)
	const heading = `Step ${location.traceIndex + 1} of ${count}${roleLabel ? ` · ${roleLabel}` : ''}`
	const directLogicalLocation = step?.location?.logicalLocations?.[0]
	const logicalLocation = directLogicalLocation?.index === undefined
		? directLogicalLocation
		: (run as any).logicalLocations?.[directLogicalLocation.index] ?? directLogicalLocation
	const logicalName = logicalLocation?.fullyQualifiedName ?? logicalLocation?.decoratedName
		?? logicalLocation?.name ?? step?.module
	const stateEntries = Object.entries(step?.state ?? {}).map(([name, value]) => {
		const description = multiformatText(value)
		return {name, text: description && description !== name ? `${name} — ${description}` : name}
	})
	const state = stateEntries.length
		? `${stateEntries.length === 1 ? 'Value' : 'State'}: ${stateEntries.map(entry => entry.text).join('; ')}`
		: undefined
	const symbol = typeof acah?.symbol === 'string' && acah.symbol && !stateEntries.some(entry => entry.name === acah.symbol)
		? `Symbol: ${acah.symbol}`
		: undefined
	const importance = step?.importance && step.importance !== 'important'
		? `Importance: ${readableName(step.importance)}`
		: undefined
	const nesting = typeof step?.nestingLevel === 'number' && step.nestingLevel > 0
		? `Call depth: ${step.nestingLevel}`
		: undefined
	const resolution = typeof acah?.resolution === 'string' && acah.resolution
		? `Resolution: ${acah.resolution}`
		: undefined
	return [
		heading,
		resolvedTraceLocationText(location, run, formatPath),
		logicalName ? `Symbol location: ${logicalName}` : undefined,
		state,
		symbol,
		importance,
		nesting,
		resolution,
	].filter(Boolean).join('\n')
}

function originTooltip(origin: ResolvedTraceOrigin, run: Run, formatPath?: SourcePathFormatter): string {
	const role = origin.kind ? readableName(origin.kind) : 'Origin'
	const location = resolvedTraceLocationText({...origin, traceIndex: -1}, run, formatPath)
	return [`Origin · ${role}`, origin.name ? `Value: ${origin.name}` : undefined, location].filter(Boolean).join('\n')
}

interface IdentifierRegion {
	identifier: string
	region: Region
}

function lineOffsets(text: string): number[] {
	const offsets = [0]
	for (let index = 0; index < text.length; index++) {
		if (text[index] === '\n') offsets.push(index + 1)
	}
	return offsets
}

function offsetToPosition(text: string, offset: number): {line: number, column: number} {
	const offsets = lineOffsets(text)
	let lineIndex = offsets.length - 1
	while (lineIndex > 0 && offsets[lineIndex] > offset) lineIndex--
	return {line: lineIndex + 1, column: offset - offsets[lineIndex] + 1}
}

function regionOffsets(text: string, region: Region): [number, number] | undefined {
	if (!region.startLine) return undefined
	const offsets = lineOffsets(text)
	const startLineIndex = region.startLine - 1
	const endLineIndex = (region.endLine ?? region.startLine) - 1
	if (startLineIndex >= offsets.length || endLineIndex >= offsets.length) return undefined
	const start = offsets[startLineIndex] + Math.max(0, (region.startColumn ?? 1) - 1)
	const endLineEnd = endLineIndex + 1 < offsets.length ? offsets[endLineIndex + 1] - 1 : text.length
	const end = region.endColumn === undefined
		? endLineEnd
		: Math.min(endLineEnd, offsets[endLineIndex] + Math.max(0, region.endColumn - 1))
	return [Math.min(start, text.length), Math.max(start, Math.min(end, text.length))]
}

function regionFromOffsets(text: string, start: number, end: number): Region {
	const startPosition = offsetToPosition(text, start)
	const endPosition = offsetToPosition(text, end)
	return {
		startLine: startPosition.line,
		startColumn: startPosition.column,
		endLine: endPosition.line,
		endColumn: endPosition.column,
	}
}

function identifierOccurrences(text: string, start: number, end: number, identifier: string): Array<[number, number]> {
	const occurrences: Array<[number, number]> = []
	let index = text.indexOf(identifier, start)
	const isIdentifierCharacter = (character: string | undefined) => !!character && /[A-Za-z0-9_$]/.test(character)
	while (index >= 0 && index + identifier.length <= end) {
		if (!isIdentifierCharacter(text[index - 1]) && !isIdentifierCharacter(text[index + identifier.length])) {
			occurrences.push([index, index + identifier.length])
		}
		index = text.indexOf(identifier, index + identifier.length)
	}
	return occurrences
}

function likelyDeclarationTypeOccurrence(text: string, end: number): boolean {
	let next = end
	while (next < text.length && /[ \t]/.test(text[next])) next++
	return next !== end && /[A-Za-z_$]/.test(text[next] ?? '')
}

function exactIdentifierRegion(text: string, region: Region): IdentifierRegion | undefined {
	if (region.endColumn === undefined || (region.endLine ?? region.startLine) !== region.startLine) return undefined
	const offsets = regionOffsets(text, region)
	if (!offsets) return undefined
	const selected = text.slice(offsets[0], offsets[1])
	const leading = selected.length - selected.trimStart().length
	const identifier = selected.trim()
	if (!/^[A-Za-z_$][\w$]*$/.test(identifier)) return undefined
	const start = offsets[0] + leading
	if (likelyDeclarationTypeOccurrence(text, start + identifier.length)) return undefined
	return {identifier, region: regionFromOffsets(text, start, start + identifier.length)}
}

function uniqueIdentifierInRegion(text: string, region: Region, identifier: string): Region | undefined {
	const offsets = regionOffsets(text, region)
	if (!offsets) return undefined
	const occurrences = identifierOccurrences(text, offsets[0], offsets[1], identifier)
		.filter(([, end]) => !likelyDeclarationTypeOccurrence(text, end))
	return occurrences.length === 1 ? regionFromOffsets(text, occurrences[0][0], occurrences[0][1]) : undefined
}

function firstParameterRegion(text: string, locationRegion: Region, identifier: string): Region | undefined {
	const locationOffsets = regionOffsets(text, locationRegion)
	if (!locationOffsets) return undefined
	const start = text.lastIndexOf('\n', locationOffsets[0] - 1) + 1
	const limit = Math.min(text.length, start + 4000)
	let depth = 0
	let pairStart = -1
	let quote: string | undefined
	let lineComment = false
	let blockComment = false
	const pairs: Array<[number, number]> = []
	for (let index = start; index < limit; index++) {
		const character = text[index]
		const next = text[index + 1]
		if (lineComment) {
			if (character === '\n') lineComment = false
			continue
		}
		if (blockComment) {
			if (character === '*' && next === '/') { blockComment = false; index++ }
			continue
		}
		if (quote) {
			if (character === '\\') { index++; continue }
			if (character === quote) quote = undefined
			continue
		}
		if (character === '/' && next === '/') { lineComment = true; index++; continue }
		if (character === '/' && next === '*') { blockComment = true; index++; continue }
		if (character === '"' || character === "'" || character === '`') { quote = character; continue }
		if (depth === 0 && (character === '{' || character === ';' || (character === '=' && next === '>'))) break
		if (character === '(') {
			if (depth++ === 0) pairStart = index + 1
		} else if (character === ')' && depth > 0 && --depth === 0) {
			pairs.push([pairStart, index])
			if (pairs.length >= 3) break
		}
	}
	const matches = pairs.flatMap(pair => identifierOccurrences(text, pair[0], pair[1], identifier))
	return matches.length === 1 ? regionFromOffsets(text, matches[0][0], matches[0][1]) : undefined
}

function inferIdentifierHighlights(
	trace: SourceTrace,
	resolvedTrace: ResolvedTraceLocation[],
	sourceFilesByKey: Map<string, SourceFile>,
): Map<number, {region: Region, color: string}> {
	if (!trace.inferIdentifiers) return new Map()
	const exactSeeds = resolvedTrace.flatMap(location => {
		const source = location.key && sourceFilesByKey.get(location.key)
		const exact = source && location.region && exactIdentifierRegion(source.text, location.region)
		return exact ? [{...exact, key: location.key, traceIndex: location.traceIndex}] : []
	})
	const explicitHints = [
		...resolvedTrace.filter(location => location.identifierHint).map(location => location.identifierHint),
		trace.origin?.name,
	].filter(Boolean) as string[]
	const candidateNames = Array.from(new Set([...explicitHints, ...exactSeeds.map(seed => seed.identifier)]))
	const candidates = candidateNames.map(identifier => {
		const explicit = explicitHints.includes(identifier)
		const seed = exactSeeds.find(candidate => candidate.identifier === identifier)
		const matches = resolvedTrace.flatMap(location => {
			if (!location.key || !location.region || (!explicit && seed?.key !== location.key)) return []
			const source = sourceFilesByKey.get(location.key)
			if (!source) return []
			const region = uniqueIdentifierInRegion(source.text, location.region, identifier)
				?? (location.traceIndex === 0 ? firstParameterRegion(source.text, location.region, identifier) : undefined)
			return region ? [{traceIndex: location.traceIndex, region}] : []
		})
		return {identifier, explicit, matches}
	}).filter(candidate => candidate.matches.length >= (candidate.explicit ? 1 : 2))
	if (!candidates.length) return new Map()
	const bestScore = Math.max(...candidates.map(candidate => candidate.matches.length + (candidate.explicit ? 1000 : 0)))
	const best = candidates.filter(candidate => candidate.matches.length + (candidate.explicit ? 1000 : 0) === bestScore)
	if (best.length !== 1) return new Map()
	const firstIndex = Math.min(...best[0].matches.map(match => match.traceIndex))
	const color = traceColor(firstIndex, resolvedTrace.length, resolvedTrace[firstIndex]?.role)
	return new Map(best[0].matches.map(match => [match.traceIndex, {region: match.region, color}]))
}

export async function openSourceFile(
	artifactLocation: ArtifactLocation,
	run: Run,
	region: Region | undefined,
	reader: SourceFileReader | undefined,
	trace?: SourceTrace,
	formatPath?: SourcePathFormatter,
	navigation?: SourceNavigation,
	activeFindingId?: string,
	existingTarget?: Window,
): Promise<void> {
	const activeKey = sourceViewKey(artifactLocation) ?? 'active-source-file'
	const findings = navigation?.byFile.get(activeKey) ?? []
	const sourceWindowName = navigation
		? `swc-source-${stableSha256(JSON.stringify([navigation.reportId, activeKey, findings.map(finding => finding.id).sort()]))}`
		: '_blank'
	// Open synchronously during the click event so popup blockers do not reject it after the async read.
	const target = existingTarget ?? window.open('about:blank', sourceWindowName)
	if (!target) return
	if (!navigation) target.opener = null
	target.focus?.()
	target.document.title = sourceDocumentTitle(artifactLocation.uri)
	target.document.body.textContent = 'Loading source file...'

	try {
		const sourceFile = await readSourceFile(artifactLocation, run, reader)
		if (!sourceFile) {
			target.document.body.textContent = `Unable to read ${artifactLocation.uri ?? 'source file'} from the selected source folder.`
			return
		}

		const resolvedTrace: ResolvedTraceLocation[] = trace?.locations.map((physicalLocation, traceIndex) => {
			const resolvedArtifactLocation = getArtifactLocation(physicalLocation, run)
			const step = trace.steps?.[traceIndex]
			const resolved: ResolvedTraceLocation = {
				traceIndex,
				artifactLocation: resolvedArtifactLocation,
				key: resolvedArtifactLocation && sourceViewKey(resolvedArtifactLocation),
				region: physicalLocation?.region,
				identifierHint: trace.identifierHints?.[traceIndex],
				step,
				role: getTraceStepRole(step, run),
			}
			resolved.tooltip = traceLocationTooltip(resolved, trace.locations.length, run, formatPath)
			return resolved
		}) ?? []
		const resolvedOrigin: ResolvedTraceOrigin | undefined = trace?.origin && (() => {
			const originArtifactLocation = getArtifactLocation(trace.origin.location, run)
			return {
				...trace.origin,
				artifactLocation: originArtifactLocation,
				key: originArtifactLocation && sourceViewKey(originArtifactLocation),
				region: trace.origin.location.region,
			}
		})()
		const artifactsByKey = new Map<string, ArtifactLocation>()
		resolvedTrace.forEach(location => {
			if (location.key && location.artifactLocation && !artifactsByKey.has(location.key)) {
				artifactsByKey.set(location.key, location.artifactLocation)
			}
		})
		if (resolvedOrigin?.key && resolvedOrigin.artifactLocation && !artifactsByKey.has(resolvedOrigin.key)) {
			artifactsByKey.set(resolvedOrigin.key, resolvedOrigin.artifactLocation)
		}
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

		const usedViewIds = new Set<string>()
		const views: SourceFileView[] = Array.from(artifactsByKey.keys())
			.filter(key => sourceFilesByKey.has(key))
			.map((key, index) => {
				const sourceFile = sourceFilesByKey.get(key)
				const location = artifactsByKey.get(key)
				const formattedName = location?.uri && formatPath?.(location.uri, run, location)
				const name = formattedName || sourceFile.name || `source-file-${index + 1}`
					let id = `source-file-${index + 1}`
					for (let duplicate = 2; usedViewIds.has(id); duplicate++) id = `source-file-${index + 1}-${duplicate}`
				usedViewIds.add(id)
				return {id, key, name, sourceFile, highlights: [], findingMarkers: []}
			})
		const viewsByKey = new Map(views.map(view => [view.key, view] as [string, SourceFileView]))
		findings.forEach(finding => {
			const findingArtifact = getArtifactLocation(finding.location, finding.run)
			const findingKey = findingArtifact && sourceViewKey(findingArtifact)
			const view = findingKey && viewsByKey.get(findingKey)
			if (view?.sourceFile && finding.location.region?.startLine) view.findingMarkers.push(finding)
		})
		const adjacentEntry = (traceIndex: number, direction: -1 | 1): SourceNavigationTarget | undefined => {
			for (let index = traceIndex + direction; index >= 0 && index < resolvedTrace.length; index += direction) {
				const location = resolvedTrace[index]
				const view = location.key && viewsByKey.get(location.key)
				if (view) return {id: view.id, name: view.name, traceIndex: location.traceIndex}
			}
			return undefined
		}
		const identifierHighlights = trace ? inferIdentifierHighlights(trace, resolvedTrace, sourceFilesByKey) : new Map()
		const identifierColor = identifierHighlights.values().next().value?.color
			?? traceColor(0, Math.max(1, resolvedTrace.length), resolvedTrace[0]?.role)
		views.forEach(view => {
			view.highlights = resolvedTrace
				.filter(location => location.key === view.key && location.region?.startLine)
				.map(location => ({
					region: location.region,
					traceIndex: location.traceIndex,
					color: traceColor(location.traceIndex, resolvedTrace.length, location.role),
					role: location.role,
					isStart: !location.role && location.traceIndex === 0,
					isEnd: !location.role && location.traceIndex === resolvedTrace.length - 1,
					isActive: location.traceIndex === trace?.activeIndex,
					previousEntry: adjacentEntry(location.traceIndex, -1),
					nextEntry: adjacentEntry(location.traceIndex, 1),
					tooltip: location.tooltip,
				}))
			resolvedTrace
				.filter(location => location.key === view.key && identifierHighlights.has(location.traceIndex))
				.forEach(location => {
					const inferred = identifierHighlights.get(location.traceIndex)
					view.highlights.push({
						region: inferred.region,
						traceIndex: location.traceIndex,
						color: inferred.color,
						isIdentifier: true,
						isActive: location.traceIndex === trace?.activeIndex,
						tooltip: location.tooltip,
					})
				})
			if (resolvedOrigin?.key === view.key && resolvedOrigin.region) {
				const source = sourceFilesByKey.get(view.key)
				const originRegion = source && resolvedOrigin.name
					? uniqueIdentifierInRegion(source.text, resolvedOrigin.region, resolvedOrigin.name)
					: resolvedOrigin.region
				if (originRegion) view.highlights.push({
					region: originRegion,
					color: identifierColor,
					isIdentifier: !!resolvedOrigin.name,
					tooltip: originTooltip(resolvedOrigin, run, formatPath),
				})
			}
		})
		const activeView = viewsByKey.get(activeKey)
		if (region?.startLine && activeView && !activeView.highlights.length) {
			activeView.highlights.push({ region, color: 'hsl(55, 90%, 75%)' })
		}
		const traceSummary: SourceTraceSummary | undefined = trace && {
			label: trace.label ?? 'Trace',
			totalEntries: resolvedTrace.length,
			readableEntries: resolvedTrace.filter(location => location.key && sourceFilesByKey.has(location.key)).length,
			activeIndex: trace.activeIndex,
			roles: resolvedTrace.map(location => location.role),
			missing: resolvedTrace
				.filter(location => !location.key || !sourceFilesByKey.has(location.key))
				.map(location => ({
					traceIndex: location.traceIndex,
					name: location.artifactLocation?.uri
						? formatPath?.(location.artifactLocation.uri, run, location.artifactLocation) ?? location.artifactLocation.uri
						: 'No source location',
				})),
		}
		const navigateFinding = (finding: SourceFindingNavigation) => {
			const findingArtifact = getArtifactLocation(finding.location, finding.run)
			if (!findingArtifact) return
			void openSourceFile(
				findingArtifact,
				finding.run,
				finding.location.region,
				reader,
				finding.trace,
				formatPath,
				navigation,
				finding.id,
				target,
			)
		}
		renderSourceDocument(target, views, activeKey, traceSummary, findings, activeFindingId, navigateFinding)
	} catch (error) {
		target.document.body.textContent = `Unable to open source file: ${error instanceof Error ? error.message : String(error)}`
	}
}
