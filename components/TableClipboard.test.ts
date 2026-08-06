import * as React from 'react'
import {copySelectedTableCells} from './TableClipboard'

test('copies selected finding cells as tab-separated rows', () => {
	const root = document.createElement('div')
	root.innerHTML = `<table><tbody>
		<tr data-row-index="0"><td class="bolt-table-cell" data-column-index="0">one</td><td class="bolt-table-cell" data-column-index="1">two\nlines</td></tr>
		<tr data-row-index="1"><td class="bolt-table-cell" data-column-index="0">three</td><td class="bolt-table-cell" data-column-index="1">four</td></tr>
		<tr><td class="bolt-table-cell" data-column-index="0" colspan="99">Show all</td></tr>
	</tbody></table>`
	document.body.appendChild(root)
	const range = document.createRange()
	range.selectNodeContents(root.querySelector('tbody'))
	const selection = window.getSelection()
	selection.removeAllRanges()
	selection.addRange(range)
	const setData = jest.fn()
	const preventDefault = jest.fn()

	copySelectedTableCells({currentTarget: root, clipboardData: {setData}, preventDefault} as unknown as React.ClipboardEvent<HTMLElement>)

	expect(setData).toHaveBeenCalledWith('text/plain', 'one\ttwo lines\nthree\tfour')
	expect(preventDefault).toHaveBeenCalled()
	selection.removeAllRanges()
	root.remove()
})

test('leaves ordinary text copied within one cell unchanged', () => {
	const root = document.createElement('div')
	root.innerHTML = '<table><tbody><tr><td class="bolt-table-cell" data-column-index="0">one cell</td></tr></tbody></table>'
	document.body.appendChild(root)
	const range = document.createRange()
	range.selectNodeContents(root.querySelector('td'))
	const selection = window.getSelection()
	selection.removeAllRanges()
	selection.addRange(range)
	const setData = jest.fn()
	const preventDefault = jest.fn()

	copySelectedTableCells({currentTarget: root, clipboardData: {setData}, preventDefault} as unknown as React.ClipboardEvent<HTMLElement>)

	expect(setData).not.toHaveBeenCalled()
	expect(preventDefault).not.toHaveBeenCalled()
	selection.removeAllRanges()
	root.remove()
})
