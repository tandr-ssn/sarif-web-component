import * as React from 'react'
import {copySelectedTableCells} from './TableClipboard'

test('copies selected finding cells as tab-separated rows with multiline cells', () => {
	const root = document.createElement('div')
	root.innerHTML = `<table><tbody>
		<tr data-row-index="0"><td class="bolt-table-cell" data-column-index="0">one</td><td class="bolt-table-cell" data-column-index="1"><span hidden data-copy-value="Finding message&#10;&#10;src/app.ts:10&#10;10  const value = &quot;quoted&quot;"></span>Finding message<details open data-copy-trace-value="Code flow&#10;1. src/app.ts:12&#10;12  use(value);"><summary>Code flow</summary>Hidden trace</details></td></tr>
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

	expect(setData).toHaveBeenCalledWith('text/plain', 'one\t"Finding message\n\nsrc/app.ts:10\n10  const value = ""quoted""\n\nCode flow\n1. src/app.ts:12\n12  use(value);"\nthree\tfour')
	expect(preventDefault).toHaveBeenCalled()
	selection.removeAllRanges()
	root.remove()
})

test('copies a completely selected single cell', () => {
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

	expect(setData).toHaveBeenCalledWith('text/plain', 'one cell')
	expect(preventDefault).toHaveBeenCalled()
	selection.removeAllRanges()
	root.remove()
})

test('leaves a partial text selection within one cell unchanged', () => {
	const root = document.createElement('div')
	root.innerHTML = '<table><tbody><tr><td class="bolt-table-cell" data-column-index="0">one cell</td></tr></tbody></table>'
	document.body.appendChild(root)
	const text = root.querySelector('td')?.firstChild as Text
	const range = document.createRange()
	range.setStart(text, 0)
	range.setEnd(text, 3)
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

test('always copies a Details cell using its semantic copy value', () => {
	const root = document.createElement('div')
	root.innerHTML = '<table><tbody><tr><td class="bolt-table-cell" data-column-index="0"><span hidden data-copy-value="Finding&#10;&#10;20  source();" data-copy-always="true"></span>Finding rendered snippet</td></tr></tbody></table>'
	document.body.appendChild(root)
	const text = root.querySelector('td')?.lastChild as Text
	const range = document.createRange()
	range.setStart(text, 0)
	range.setEnd(text, 7)
	const selection = window.getSelection()
	selection.removeAllRanges()
	selection.addRange(range)
	const setData = jest.fn()
	const preventDefault = jest.fn()

	copySelectedTableCells({currentTarget: root, clipboardData: {setData}, preventDefault} as unknown as React.ClipboardEvent<HTMLElement>)

	expect(setData).toHaveBeenCalledWith('text/plain', '"Finding\n\n20  source();"')
	expect(preventDefault).toHaveBeenCalled()
	selection.removeAllRanges()
	root.remove()
})
