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
	expect(childWindow.opener).toBeNull()
	open.mockRestore()
})
