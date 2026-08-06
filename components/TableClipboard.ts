function normalizedCellText(cell: HTMLElement): string {
	return (cell.innerText || cell.textContent || '')
		.replace(/\t/g, ' ')
		.replace(/\s*\r?\n\s*/g, ' ')
		.trim()
}

function intersects(range: Range, cell: HTMLElement): boolean {
	try {
		return range.intersectsNode(cell)
	} catch (_) {
		return false
	}
}

/** Copies a multi-cell browser selection as tab-separated rows for spreadsheets. */
export function copySelectedTableCells(event: React.ClipboardEvent<HTMLElement>): void {
	const selection = event.currentTarget.ownerDocument.defaultView?.getSelection()
	if (!selection || selection.isCollapsed || !selection.rangeCount) return

	const ranges = Array.from({length: selection.rangeCount}, (_, index) => selection.getRangeAt(index))
	const cells = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
		'tbody td.bolt-table-cell[data-column-index]:not([colspan])'))
		.filter(cell => ranges.some(range => intersects(range, cell)))
	if (cells.length < 2) return

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
			.map(normalizedCellText)
			.join('\t'))
		.join('\n')
	event.clipboardData.setData('text/plain', text)
	event.preventDefault()
}
