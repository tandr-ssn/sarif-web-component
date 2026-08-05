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
	expect(childDocument.querySelector('pre')?.textContent).toBe(source)
	expect(childDocument.querySelector('script')).toBeNull()
	expect(childDocument.querySelectorAll('.source-line')).toHaveLength(1)
	expect(childDocument.querySelector('.source-line')?.getAttribute('data-line')).toBe('1')
	expect(childWindow.opener).toBeNull()
	expect(open).toHaveBeenCalledWith('about:blank', '_blank')
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
	expect(childDocument.querySelector('pre')?.textContent).toBe(source)
	expect(Array.from(childDocument.querySelectorAll('mark')).map(mark => mark.textContent)).toEqual(['ne\n', 'tw'])
	open.mockRestore()
})

test('highlights every trace entry in a file and links between trace files', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = {
		document: childDocument,
		opener: window,
		location: { hash: '' },
		navigator: { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } },
	} as any as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const files = {
		'src/app.ts': 'app one\napp two\napp three',
		'src/lib.ts': 'lib one\nlib two',
		'src/end.ts': 'end one',
	}
	const reader = jest.fn(async artifactLocation => {
		const text = files[artifactLocation.uri]
		return text === undefined ? undefined : { name: artifactLocation.uri, text }
	})
	const locations: any[] = [
		{ artifactLocation: { uri: 'src/app.ts' }, region: { startLine: 1 } },
		{ artifactLocation: { uri: 'src/missing.ts' }, region: { startLine: 1 } },
		{ artifactLocation: { uri: 'src/lib.ts' }, region: { startLine: 2 } },
		{ artifactLocation: { uri: 'src/app.ts' }, region: { startLine: 3 } },
		{ artifactLocation: { uri: 'src/end.ts' }, region: { startLine: 1 } },
	]
	const run = {} as any

	await openSourceFile(
		locations[3].artifactLocation,
		run,
		locations[3].region,
		reader,
		{ locations, activeIndex: 3, label: 'Call stack' },
	)

	expect(childDocument.querySelectorAll('.source-file')).toHaveLength(3)
	expect(childWindow.location.hash).toBe('source-file-1')
	const appSection = childDocument.getElementById('source-file-1')
	expect(Array.from(appSection.querySelectorAll('.trace-badge > button')).map(badge => badge.textContent)).toEqual(['1', '4'])
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
	expect(childDocument.querySelector('.trace-missing')?.textContent).toContain('4 of 5 trace locations readable')
	expect(childDocument.querySelector('.trace-missing')?.textContent).toContain('src/missing.ts')
	expect(childDocument.querySelector('[data-trace-position]')?.textContent).toBe('Entry 4 of 5 · File 1 of 3')
	;(childDocument.querySelector('[data-trace-action="next"]') as HTMLButtonElement).click()
	expect(childWindow.location.hash).toBe('source-file-3')
	expect(childDocument.getElementById('source-file-3').querySelector('.trace-active')).not.toBeNull()
	childDocument.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }))
	expect(childWindow.location.hash).toBe('source-file-1')
	appSection.querySelector('[data-activate-trace="0"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
	const copyPathAndLine = childDocument.querySelector('[data-copy="path-line"]') as HTMLButtonElement
	expect(copyPathAndLine).not.toBeNull()
	expect(copyPathAndLine.onclick).not.toBeNull()
	copyPathAndLine.onclick(new MouseEvent('click'))
	await new Promise(resolve => setTimeout(resolve, 0))
	expect(childDocument.querySelector('[data-copy-status]')?.textContent).toBe('Copied')
	expect((childWindow.navigator.clipboard.writeText as jest.Mock)).toHaveBeenCalledWith('src/app.ts:1')
	const copyTrace = childDocument.querySelector('[data-copy="trace"]') as HTMLButtonElement
	copyTrace.onclick(new MouseEvent('click'))
	await new Promise(resolve => setTimeout(resolve, 0))
	expect((childWindow.navigator.clipboard.writeText as jest.Mock).mock.calls[1][0]).toContain([
		'Call stack',
		'1. src/app.ts:1',
		'2. unavailable: src/missing.ts',
	].join('\n'))
	expect(reader).toHaveBeenCalledTimes(4)
	await openSourceFile(
		locations[0].artifactLocation,
		run,
		locations[0].region,
		reader,
		{ locations, activeIndex: 0, label: 'Call stack' },
	)
	expect(reader).toHaveBeenCalledTimes(4)
	open.mockRestore()
})
