function normalizedCellText(cell: HTMLElement): string {
	const marker = cell.querySelector<HTMLElement>('[data-copy-value]')
	const copyValue = marker?.dataset.copyValue
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
		if (alwaysCopy) {
			event.clipboardData.setData('text/plain', tsvCell(normalizedCellText(cells[0])))
			event.preventDefault()
			return
		}
		const selectedText = selection.toString()
		const renderedText = cells[0].innerText || cells[0].textContent || ''
		if (comparableText(selectedText) !== comparableText(renderedText)) return
		event.clipboardData.setData('text/plain', tsvCell(selectedText.replace(/\r\n?/g, '\n').trim()))
		event.preventDefault()
		return
	}

	const rows = new Map<Element, HTMLElement[]>()
	for (const cell of cells) {
		const row = cell.closest('tr')
		if (!row) continue
		const rowCells = rows.get(row) ?? []
		rowCells.push(cell)
		rows.set(row, rowCells)
	}
	if (!rows.size) return

	const text = Array.from(rows.values())
		.map(rowCells => rowCells
			.sort((left, right) => Number(left.dataset.columnIndex) - Number(right.dataset.columnIndex))
			.map(cell => tsvCell(normalizedCellText(cell)))
			.join('\t'))
		.join('\n')
	event.clipboardData.setData('text/plain', text)
	event.preventDefault()
}
