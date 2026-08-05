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

test('highlights every trace entry in a file and links between trace files', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = {
		document: childDocument,
		opener: window,
		location: { hash: '' },
	} as any as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const files = {
		'src/app.ts': 'app one\napp two\napp three',
		'src/lib.ts': 'lib one\nlib two',
		'src/end.ts': 'end one',
	}
	const reader = async artifactLocation => {
		const text = files[artifactLocation.uri]
		return text === undefined ? undefined : { name: artifactLocation.uri, text }
	}
	const locations: any[] = [
		{ artifactLocation: { uri: 'src/app.ts' }, region: { startLine: 1 } },
		{ artifactLocation: { uri: 'src/lib.ts' }, region: { startLine: 2 } },
		{ artifactLocation: { uri: 'src/app.ts' }, region: { startLine: 3 } },
		{ artifactLocation: { uri: 'src/end.ts' }, region: { startLine: 1 } },
	]

	await openSourceFile(
		locations[2].artifactLocation,
		{} as any,
		locations[2].region,
		reader,
		{ locations, activeIndex: 2 },
	)

	expect(childDocument.querySelectorAll('.source-file')).toHaveLength(3)
	expect(childWindow.location.hash).toBe('source-file-1')
	const appSection = childDocument.getElementById('source-file-1')
	expect(Array.from(appSection.querySelectorAll('.trace-badge strong')).map(badge => badge.textContent)).toEqual(['1', '3'])
	expect(appSection.querySelector('.trace-start')).not.toBeNull()
	expect(appSection.querySelector('[data-line="3"] .trace-active')).not.toBeNull()
	expect(appSection.querySelector('[data-line="3"] .trace-active-highlight')).not.toBeNull()
	const appMarkStyles = Array.from(appSection.querySelectorAll('mark')).map(mark => mark.getAttribute('style'))
	expect(new Set(appMarkStyles).size).toBe(2)
	expect(Array.from(appSection.querySelectorAll('a')).map(link => link.getAttribute('href'))).toEqual([
		'#source-file-2',
		'#source-file-2',
		'#source-file-3',
	])
	expect(childDocument.getElementById('source-file-3').querySelector('.trace-end')).not.toBeNull()
	open.mockRestore()
})
