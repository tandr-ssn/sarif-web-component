import {markdownToPlainText} from './MarkdownText'

function normalizedCellText(cell: HTMLElement): string {
	const marker = cell.querySelector<HTMLElement>('[data-copy-value]')
	const copyValue = marker?.dataset.copyMarkdownValue === undefined
		? marker?.dataset.copyValue
		: markdownToPlainText(marker.dataset.copyMarkdownValue)
	const openTraces = Array.from(cell.querySelectorAll<HTMLDetailsElement>('details[open][data-copy-trace-value]'))
		.map(trace => trace.dataset.copyTraceValue ?? '')
		.filter(Boolean)
	return [copyValue ?? (cell.innerText || cell.textContent || ''), ...openTraces]
		.filter(Boolean).join('\n\n')
		.replace(/\t/g, ' ')
		.replace(/\r\n?/g, '\n')
		.trim()
}

function tsvCell(value: string): string {
	return /["\r\n\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function intersects(range: Range, cell: HTMLElement): boolean {
	try {
		return range.intersectsNode(cell)
	} catch (_) {
		return false
	}
}

function comparableText(value: string): string {
	return value.replace(/\s+/g, ' ').trim()
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function cellHtml(cell: HTMLElement, rich: boolean): string {
	if (!rich) {
		const text = escapeHtml(normalizedCellText(cell)).replace(/\n/g, '<br>')
		return `<td style="vertical-align:top;white-space:pre-wrap">${text}</td>`
	}
	const clone = cell.cloneNode(true) as HTMLElement
	clone.querySelectorAll('[data-copy-value], script, style').forEach(element => element.remove())
	clone.querySelectorAll('[data-swc-tooltip]').forEach(element => element.removeAttribute('data-swc-tooltip'))
	clone.querySelectorAll<HTMLElement>('table').forEach(table => table.style.borderCollapse = 'collapse')
	clone.querySelectorAll<HTMLElement>('th, td').forEach(element => {
		element.style.border = '1px solid #c8c8c8'
		element.style.padding = '4px 8px'
	})
	return `<td style="vertical-align:top;white-space:pre-wrap">${clone.innerHTML}</td>`
}

function rowsForCells(cells: HTMLElement[]): Map<Element, HTMLElement[]> {
	const rows = new Map<Element, HTMLElement[]>()
	for (const cell of cells) {
		const row = cell.closest('tr')
		if (!row) continue
		const rowCells = rows.get(row) ?? []
		rowCells.push(cell)
		rows.set(row, rowCells)
	}
	rows.forEach(row => row.sort((left, right) => Number(left.dataset.columnIndex) - Number(right.dataset.columnIndex)))
	return rows
}

function setRichClipboardData(event: React.ClipboardEvent<HTMLElement>, rows: Map<Element, HTMLElement[]>, rich: boolean) {
	const html = '<table><tbody>' + Array.from(rows.values())
		.map(row => `<tr>${row.map(cell => cellHtml(cell, rich)).join('')}</tr>`).join('') + '</tbody></table>'
	event.clipboardData.setData('text/html', html)
}

/** Copies complete selected table cells as tab-separated rows for spreadsheets. */
export function copySelectedTableCells(event: React.ClipboardEvent<HTMLElement>): void {
	const selection = event.currentTarget.ownerDocument.defaultView?.getSelection()
	if (!selection || selection.isCollapsed || !selection.rangeCount) return

	const ranges = Array.from({length: selection.rangeCount}, (_, index) => selection.getRangeAt(index))
	const cells = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
		'tbody td.bolt-table-cell[data-column-index]:not([colspan])'))
		.filter(cell => ranges.some(range => intersects(range, cell)))
	if (!cells.length) return
	if (cells.length === 1) {
		const alwaysCopy = cells[0].querySelector<HTMLElement>('[data-copy-always]') !== null
		const selectedText = selection.toString()
		const renderedText = cells[0].innerText || cells[0].textContent || ''
		if (!alwaysCopy && comparableText(selectedText) !== comparableText(renderedText)) return
		const marker = cells[0].querySelector<HTMLElement>('[data-copy-value]')
		const plain = marker || alwaysCopy ? normalizedCellText(cells[0]) : selectedText.replace(/\r\n?/g, '\n').trim()
		event.clipboardData.setData('text/plain', tsvCell(plain))
		const markdown = marker?.dataset.copyMarkdownValue
		if (markdown !== undefined) event.clipboardData.setData('text/markdown', markdown)
		setRichClipboardData(event, rowsForCells(cells), true)
		event.preventDefault()
		return
	}

	const rows = rowsForCells(cells)
	if (!rows.size) return

	const text = Array.from(rows.values())
		.map(rowCells => rowCells
			.map(cell => tsvCell(normalizedCellText(cell)))
			.join('\t'))
		.join('\n')
	event.clipboardData.setData('text/plain', text)
	setRichClipboardData(event, rows, false)
	event.preventDefault()
}
