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
	expect(setData).toHaveBeenCalledWith('text/html', expect.stringContaining('<table>'))
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
	expect(setData).toHaveBeenCalledWith('text/html', expect.stringContaining('one cell'))
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
	const html = setData.mock.calls.find(([type]) => type === 'text/html')?.[1]
	expect(html).toContain('Finding<br><br>20  source();')
	expect(html).not.toContain('Finding rendered snippet')
	expect(preventDefault).toHaveBeenCalled()
	selection.removeAllRanges()
	root.remove()
})

test('copies an embedded Path and Details as separate logical cells', () => {
	const root = document.createElement('div')
	root.innerHTML = '<table><tbody><tr><td class="bolt-table-cell" data-column-index="0"><span hidden data-copy-value="Finding" data-copy-leading-value="calgary/src/app.ts" data-copy-always="true"></span>calgary/src/app.ts Finding</td></tr></tbody></table>'
	document.body.appendChild(root)
	const range = document.createRange()
	range.selectNodeContents(root.querySelector('td'))
	const selection = window.getSelection()
	selection.removeAllRanges()
	selection.addRange(range)
	const setData = jest.fn()
	const preventDefault = jest.fn()

	copySelectedTableCells({currentTarget: root, clipboardData: {setData}, preventDefault} as unknown as React.ClipboardEvent<HTMLElement>)

	expect(setData).toHaveBeenCalledWith('text/plain', 'calgary/src/app.ts\tFinding')
	const html = setData.mock.calls.find(([type]) => type === 'text/html')?.[1]
	expect((html.match(/<td/g) ?? [])).toHaveLength(2)
	expect(html).toContain('calgary/src/app.ts</td>')
	expect(html).toContain('Finding</td>')
	expect(preventDefault).toHaveBeenCalled()
	selection.removeAllRanges()
	root.remove()
})

test('copies a Markdown field as plain text, rendered HTML, and Markdown source', () => {
	const root = document.createElement('div')
	root.innerHTML = `<table><tbody><tr><td class="bolt-table-cell" data-column-index="0">
		<span hidden data-copy-value="### Versions&#10;&#10;| Version | Status |&#10;| --- | --- |&#10;| 1.0 | affected |"
			data-copy-markdown-value="### Versions&#10;&#10;| Version | Status |&#10;| --- | --- |&#10;| 1.0 | affected |"></span>
		<div class="swcMarkDown"><h3>Versions</h3><table><thead><tr><th>Version</th><th>Status</th></tr></thead>
		<tbody><tr><td>1.0</td><td>affected</td></tr></tbody></table></div>
	</td></tr></tbody></table>`
	document.body.appendChild(root)
	const range = document.createRange()
	range.selectNodeContents(root.querySelector('td.bolt-table-cell'))
	const selection = window.getSelection()
	selection.removeAllRanges()
	selection.addRange(range)
	const setData = jest.fn()
	const preventDefault = jest.fn()

	copySelectedTableCells({currentTarget: root, clipboardData: {setData}, preventDefault} as unknown as React.ClipboardEvent<HTMLElement>)

	expect(setData).toHaveBeenCalledWith('text/plain', '"Versions\n\nVersion | Status\n1.0     | affected"')
	expect(setData).toHaveBeenCalledWith('text/markdown', '### Versions\n\n| Version | Status |\n| --- | --- |\n| 1.0 | affected |')
	const html = setData.mock.calls.find(([type]) => type === 'text/html')?.[1]
	expect(html).toContain('<th style=')
	expect(html).toContain('>Version</th>')
	expect(html).not.toContain('data-copy-value')
	expect(preventDefault).toHaveBeenCalled()
	selection.removeAllRanges()
	root.remove()
})

test('keeps multi-cell HTML rectangular by flattening nested Markdown tables', () => {
	const root = document.createElement('div')
	root.innerHTML = `<table><tbody><tr>
		<td class="bolt-table-cell" data-column-index="0"><span hidden data-copy-value="project/composer.lock"></span>project/composer.lock</td>
		<td class="bolt-table-cell" data-column-index="1">
			<span hidden data-copy-value="### Versions&#10;&#10;| Version | Status |&#10;| --- | --- |&#10;| 1.0 | affected |"
				data-copy-markdown-value="### Versions&#10;&#10;| Version | Status |&#10;| --- | --- |&#10;| 1.0 | affected |"></span>
			<div><h3>Versions</h3><table><tr><th>Version</th><th>Status</th></tr><tr><td>1.0</td><td>affected</td></tr></table></div>
		</td>
	</tr></tbody></table>`
	document.body.appendChild(root)
	const range = document.createRange()
	range.selectNodeContents(root.querySelector('tr'))
	const selection = window.getSelection()
	selection.removeAllRanges()
	selection.addRange(range)
	const setData = jest.fn()

	copySelectedTableCells({currentTarget: root, clipboardData: {setData}, preventDefault: jest.fn()} as unknown as React.ClipboardEvent<HTMLElement>)

	const html = setData.mock.calls.find(([type]) => type === 'text/html')?.[1]
	expect((html.match(/<table/g) ?? [])).toHaveLength(1)
	expect((html.match(/<td/g) ?? [])).toHaveLength(2)
	expect(html).toContain('project/composer.lock</td>')
	expect(html).toContain('Version | Status<br>1.0     | affected</td>')
	selection.removeAllRanges()
	root.remove()
})
