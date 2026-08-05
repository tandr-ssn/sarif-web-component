import {openSourceFile} from './SourceFile'

test('renders embedded source as text in a new tab', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = { document: childDocument, opener: window } as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const source = '<script>window.opener.location = "https://example.test"</script>'
	const run: any = {
		artifacts: [{
			location: { uri: 'src/file.ts' },
			contents: { text: source },
		}],
	}

	await openSourceFile({ uri: 'src/file.ts', index: 0 }, run, undefined, undefined)

	expect(childDocument.title).toBe('src/file.ts')
	expect(childDocument.body.textContent).toBe(source)
	expect(childDocument.querySelector('script')).toBeNull()
	expect(childDocument.querySelectorAll('.source-line')).toHaveLength(1)
	expect(childDocument.querySelector('.source-line')?.getAttribute('data-line')).toBe('1')
	expect(childWindow.opener).toBeNull()
	open.mockRestore()
})

test('adds line numbers and preserves multi-line region highlighting', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = { document: childDocument, opener: window } as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const source = 'zero\none\ntwo\nthree'
	const reader = async () => ({ name: 'file.ts', text: source })

	await openSourceFile(
		{ uri: 'src/file.ts' },
		{} as any,
		{ startLine: 2, startColumn: 2, endLine: 3, endColumn: 3 },
		reader,
	)

	const lines = Array.from(childDocument.querySelectorAll('.source-line'))
	expect(lines.map(line => line.getAttribute('data-line'))).toEqual(['1', '2', '3', '4'])
	expect(childDocument.body.textContent).toBe(source)
	expect(Array.from(childDocument.querySelectorAll('mark')).map(mark => mark.textContent)).toEqual(['ne\n', 'tw'])
	open.mockRestore()
})
