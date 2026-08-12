import {openSourceFile, traceColor} from './SourceFile'

test('keeps the seventh trace color distinct from the final marker', () => {
	expect(traceColor(6, 8)).toBe('#d8c4eb')
	expect(traceColor(7, 8)).toBe('#f5b5b0')
	expect(traceColor(0, 2, 'boundary')).toBe('#f7ee9f')
	expect(traceColor(0, 2, 'boundary')).not.toBe(traceColor(0, 2, 'source'))
})

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

	expect(childDocument.title).toBe('file.ts')
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
	expect(childDocument.querySelector('[data-current-file]')?.textContent).toBe('file.ts:2:2')
	expect(Array.from(childDocument.querySelectorAll('mark')).map(mark => mark.textContent)).toEqual(['ne\n', 'tw'])
	open.mockRestore()
})

test('expands a punctuation-only source region to readable line context', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = {document: childDocument, opener: window, location: {hash: ''}} as any as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const source = '  const river = query("'
	const startColumn = source.indexOf('"') + 1
	const region = {startLine: 1, startColumn, endColumn: startColumn + 1}
	const reader = async () => ({name: 'src/river.ts', text: source})

	await openSourceFile(
		{uri: 'src/river.ts'},
		{} as any,
		region,
		reader,
		{locations: [{artifactLocation: {uri: 'src/river.ts'}, region}], activeIndex: 0, label: 'Code flow'},
	)

	expect(childDocument.querySelector('mark')?.textContent).toBe('const river = query("')
	expect(childDocument.querySelector('[data-current-file]')?.textContent).toBe(`src/river.ts:1:${startColumn}`)
	open.mockRestore()
})

test('uses the root-relative source path as an encoded browser fragment', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = {document: childDocument, opener: window, location: {hash: ''}} as any as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const reader = async () => ({name: '/home/user/calgary/src/My file#1.ts', text: 'source'})

	await openSourceFile(
		{uri: '/home/user/calgary/src/My file#1.ts'},
		{} as any,
		undefined,
		reader,
		undefined,
		() => 'calgary/src/My file#1.ts',
	)

	expect(childWindow.location.hash).toBe('#calgary/src/My%20file%231.ts')
	expect(childDocument.getElementById('calgary/src/My file#1.ts')).not.toBeNull()
	expect(childDocument.title).toBe('My file#1.ts')
	const sourcePath = childDocument.querySelector('[data-current-file]')
	expect(sourcePath?.textContent).toBe('calgary/src/My file#1.ts:1')
	expect(sourcePath?.nextElementSibling?.classList.contains('source-toolbar-row')).toBe(true)
	const sourceStyles = Array.from(childDocument.querySelectorAll('style')).map(style => style.textContent).join('\n')
	expect(sourceStyles).toContain('font-family: "Segoe UI", "-apple-system"')
	expect(sourceStyles).toContain('font-size: 14px')
	expect(sourceStyles).toContain('padding: 6px 12px')
	expect(sourceStyles).toContain('font-weight: 400')
	open.mockRestore()
})

test('uses one color when trace regions overlap', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = {document: childDocument, opener: window, location: {hash: ''}} as any as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const reader = async () => ({name: 'src/file.ts', text: 'const value = source;'})
	const locations: any[] = [
		{artifactLocation: {uri: 'src/file.ts'}, region: {startLine: 1, startColumn: 7, endColumn: 21}},
		{artifactLocation: {uri: 'src/file.ts'}, region: {startLine: 1, startColumn: 7, endColumn: 12}},
	]

	await openSourceFile(
		locations[1].artifactLocation,
		{} as any,
		locations[1].region,
		reader,
		{locations, activeIndex: 1, label: 'Code flow'},
	)

	const overlap = childDocument.querySelector('mark[data-trace-indices="0 1"]') as HTMLElement
	expect(overlap.style.backgroundColor).toBe('rgb(245, 181, 176)')
	expect(overlap.style.backgroundImage).toBe('')
	const firstBadge = childDocument.querySelector<HTMLElement>('[data-trace-index="0"]')
	firstBadge?.querySelector('button')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))
	expect(overlap.style.backgroundColor).toBe(firstBadge?.style.backgroundColor)
	open.mockRestore()
})

test('orders same-line gutter markers by source position while preserving trace numbers', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = {document: childDocument, opener: window, location: {hash: ''}} as any as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const reader = async () => ({name: 'src/file.ts', text: 'seed\nthird(second)'})
	const locations: any[] = [
		{artifactLocation: {uri: 'src/file.ts'}, region: {startLine: 1, startColumn: 1, endColumn: 5}},
		{artifactLocation: {uri: 'src/file.ts'}, region: {startLine: 2, startColumn: 7, endColumn: 13}},
		{artifactLocation: {uri: 'src/file.ts'}, region: {startLine: 2, startColumn: 1, endColumn: 6}},
	]

	await openSourceFile(
		locations[2].artifactLocation,
		{} as any,
		locations[2].region,
		reader,
		{locations, activeIndex: 2, label: 'Code flow'},
	)

	const secondLineBadges = Array.from(childDocument.querySelectorAll('[data-line="2"] .trace-badge'))
	expect(secondLineBadges.map(badge => badge.querySelector('button')?.textContent)).toEqual(['3', '2'])
	expect(secondLineBadges[1].querySelector('.trace-next')?.getAttribute('data-activate-trace')).toBe('2')
	open.mockRestore()
})

test('caps the trace gutter at four badges and wraps additional entries', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = {document: childDocument, opener: window, location: {hash: ''}} as any as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const reader = async () => ({name: 'src/file.ts', text: 'const value = source;'})
	const locations: any[] = Array.from({length: 6}, () => ({
		artifactLocation: {uri: 'src/file.ts'},
		region: {startLine: 1, startColumn: 7, endColumn: 12},
	}))

	await openSourceFile(
		locations[0].artifactLocation,
		{} as any,
		locations[0].region,
		reader,
		{locations, activeIndex: 0, label: 'Code flow'},
	)

	expect(childDocument.querySelectorAll('.trace-column .trace-badge')).toHaveLength(6)
	const sourceStyles = Array.from(childDocument.querySelectorAll('style')).map(style => style.textContent).join('\n')
	expect(sourceStyles).toContain('flex-wrap: wrap')
	expect(sourceStyles).toContain('width: 17ch')
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
		{...locations[3].artifactLocation, uriBaseId: '%SRCROOT%'},
		run,
		locations[3].region,
		reader,
		{ locations, activeIndex: 3, label: 'Call stack' },
	)

	expect(childDocument.querySelectorAll('.source-file')).toHaveLength(3)
	expect(childWindow.location.hash).toBe('#src/app.ts')
	const appSection = childDocument.getElementById('src/app.ts')
	expect(Array.from(appSection.querySelectorAll('.trace-badge > button')).map(badge => badge.textContent)).toEqual(['1', '4'])
	expect(appSection.querySelector('.trace-start')).not.toBeNull()
	expect(appSection.querySelector('[data-line="3"] .trace-active')).not.toBeNull()
	expect(appSection.querySelector('[data-line="3"] .trace-active-highlight')).not.toBeNull()
	expect(childDocument.querySelector('[data-current-file]')?.textContent).toBe('src/app.ts:3')
	const appMarkStyles = Array.from(appSection.querySelectorAll('mark')).map(mark => mark.getAttribute('style'))
	expect(new Set(appMarkStyles).size).toBe(2)
	expect(Array.from(appSection.querySelectorAll('a')).map(link => link.getAttribute('href'))).toEqual([
		'#src/lib.ts',
		'#src/lib.ts',
		'#src/end.ts',
	])
	expect(childDocument.getElementById('src/end.ts').querySelector('.trace-end')).not.toBeNull()
	expect(childDocument.querySelector('.trace-missing')?.textContent).toContain('4 of 5 trace locations readable')
	expect(childDocument.querySelector('.trace-missing')?.textContent).toContain('src/missing.ts')
	expect(childDocument.querySelector('[data-trace-position]')?.textContent).toBe('Entry 4 of 5 · File 1 of 3')
	;(childDocument.querySelector('[data-trace-action="next"]') as HTMLButtonElement).click()
	expect(childWindow.location.hash).toBe('#src/end.ts')
	expect(childDocument.getElementById('src/end.ts').querySelector('.trace-active')).not.toBeNull()
	expect(childDocument.querySelector('[data-current-file]')?.textContent).toBe('src/end.ts:1')
	childDocument.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }))
	expect(childWindow.location.hash).toBe('#src/app.ts')
	appSection.querySelector('[data-activate-trace="0"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
	const copyPathAndLine = childDocument.querySelector('[data-copy="path-line"]') as HTMLButtonElement
	expect(copyPathAndLine).not.toBeNull()
	expect(copyPathAndLine.onclick).not.toBeNull()
	copyPathAndLine.click()
	await new Promise(resolve => setTimeout(resolve, 0))
	expect(childDocument.querySelector('[data-copy-status]')?.textContent).toBe('Copied')
	expect((childWindow.navigator.clipboard.writeText as jest.Mock)).toHaveBeenCalledWith('src/app.ts:1')
	const copyTrace = childDocument.querySelector('[data-copy="trace"]') as HTMLButtonElement
	copyTrace.click()
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

test('reuses an identifier color only inside code-flow regions and infers the first parameter', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = {
		document: childDocument,
		opener: window,
		location: {hash: ''},
	} as any as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const source = [
		'function send(source, path, other) {',
		'  const next = clean(path);',
		'  consume(path);',
		'  console.log(path);',
		'}',
	].join('\n')
	const reader = async () => ({name: 'src/app.ts', text: source})
	const locations: any[] = [
		{artifactLocation: {uri: 'src/app.ts'}, region: {startLine: 1, startColumn: 10, endColumn: 14}},
		{artifactLocation: {uri: 'src/app.ts'}, region: {startLine: 2}},
		{artifactLocation: {uri: 'src/app.ts'}, region: {startLine: 3, startColumn: 11, endColumn: 15}},
	]
	const steps: any[] = [
		{
			location: {...locations[0], message: {text: 'Recognized input source'}, logicalLocations: [{fullyQualifiedName: 'send'}]},
			importance: 'essential',
			properties: {acah: {role: 'source', symbol: 'path', resolution: 'semantic'}},
			state: {path: {text: 'tainted request value'}},
		},
		{location: {...locations[1], message: {text: 'const next = clean(path);\nconsume(next);'}}, nestingLevel: 1},
		{location: {...locations[2], message: {text: 'Value reaches sink'}}, properties: {acah: {role: 'sink'}}},
	]
	const run: any = {properties: {acah: {formatVersion: 4}}}

	await openSourceFile(
		locations[1].artifactLocation,
		run,
		locations[1].region,
		reader,
		{locations, steps, activeIndex: 1, label: 'Code flow', inferIdentifiers: true},
	)

	const identifiers = Array.from(childDocument.querySelectorAll<HTMLElement>('.trace-identifier-highlight'))
	expect(identifiers.map(mark => mark.textContent)).toEqual(['path', 'path', 'path'])
	const badges = Array.from(childDocument.querySelectorAll<HTMLElement>('.trace-badge'))
	expect(badges.map(badge => badge.querySelector('button')?.textContent)).toEqual(['1', '2', '3'])
	expect(badges[0].dataset.swcTooltip).toBe([
		'Step 1 of 3 · Source',
		'src/app.ts:1:10',
		'Symbol location: send',
		'Value: path — tainted request value',
		'Importance: Essential',
		'Resolution: semantic',
	].join('\n'))
	expect(badges[0].dataset.swcTooltip).not.toContain('Recognized input source')
	expect(badges[0].classList.contains('trace-source')).toBe(true)
	expect(badges[2].classList.contains('trace-sink')).toBe(true)
	expect(childDocument.querySelector('.legend-source')).not.toBeNull()
	expect(childDocument.querySelector('.legend-sink')).not.toBeNull()
	expect(badges[1].dataset.swcTooltip).toContain('Step 2 of 3')
	expect(badges[1].dataset.swcTooltip).toContain('Call depth: 1')
	const selectedBlockTooltip = childDocument.querySelector<HTMLElement>('[data-line="2"] mark')?.dataset.swcTooltip
	expect(selectedBlockTooltip).toContain('Step 2 of 3')
	expect(selectedBlockTooltip).not.toContain('const next = clean(path)')
	expect(selectedBlockTooltip).not.toContain('consume(next)')
	expect(childDocument.querySelector('.swcTooltip')).not.toBeNull()
	expect(identifiers[1].style.backgroundColor).toBe(badges[1].style.backgroundColor)
	expect(identifiers[2].style.backgroundColor).toBe(badges[2].style.backgroundColor)
	expect(identifiers.slice(1).map(mark => mark.style.getPropertyValue('--trace-identifier-color')))
		.toEqual(['#c7e9c0', '#c7e9c0'])
	const arrows = Array.from(childDocument.querySelectorAll('.trace-badge > a'))
	expect(arrows.map(arrow => arrow.className)).toEqual(['trace-next', 'trace-previous', 'trace-next', 'trace-previous'])
	expect(arrows.map(arrow => arrow.getAttribute('data-activate-trace'))).toEqual(['1', '0', '2', '1'])
	expect(arrows.map(arrow => arrow.getAttribute('href'))).toEqual([
		'#src/app.ts', '#src/app.ts', '#src/app.ts', '#src/app.ts',
	])
	expect(arrows.map(arrow => arrow.getAttribute('aria-label'))).toEqual([
		'Next trace entry', 'Previous trace entry', 'Next trace entry', 'Previous trace entry',
	])
	expect(arrows.every(arrow => arrow.hasAttribute('data-swc-tooltip'))).toBe(true)
	expect(arrows.every(arrow => !arrow.hasAttribute('title'))).toBe(true)
	const firstNextArrow = arrows[0] as HTMLElement
	const blur = jest.spyOn(firstNextArrow, 'blur')
	firstNextArrow.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 1}))
	expect(blur).toHaveBeenCalled()
	const sourceStyles = Array.from(childDocument.querySelectorAll('style')).map(style => style.textContent).join('\n')
	expect(sourceStyles).toContain('.trace-badge:hover > a, .trace-badge:focus-within > a')
	expect(sourceStyles).toContain('pointer-events: none')
	expect(sourceStyles).toContain('font: 16px/1.45 Arial, sans-serif')
	expect(sourceStyles).toContain('.trace-boundary')
	expect(childDocument.querySelector('[data-line="4"] mark')).toBeNull()
	expect(childDocument.querySelector('[data-line="2"] .trace-active-highlight')).not.toBeNull()
	expect(childDocument.querySelector('[data-line="2"] .trace-identifier-highlight')?.classList
		.contains('trace-active-highlight-start')).toBe(false)
	expect(childDocument.querySelector('[data-line="2"] .trace-identifier-highlight')?.classList
		.contains('trace-active-highlight-end')).toBe(false)
	const thirdBadge = childDocument.querySelector('[data-trace-index="2"]') as HTMLElement
	identifiers[2].dispatchEvent(new MouseEvent('click', {bubbles: true}))
	expect(thirdBadge.classList.contains('trace-active')).toBe(true)
	expect(identifiers[2].style.backgroundColor).toBe(thirdBadge.style.backgroundColor)
	expect(childDocument.querySelector('[data-trace-index="1"]')?.classList.contains('trace-active')).toBe(false)
	expect(childDocument.querySelector('[data-line="2"] .trace-active-highlight')).toBeNull()
	expect(Array.from(childDocument.querySelectorAll('.trace-active-highlight'))
		.every(mark => mark.getAttribute('data-trace-indices')?.split(' ').includes('2'))).toBe(true)
	open.mockRestore()
})

test('uses audit origin to highlight an input and matching identifier inside a trace region', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = {
		document: childDocument,
		opener: window,
		location: {hash: ''},
	} as any as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const source = [
		'function send(source, path, other) {',
		'  consume(path);',
		'}',
	].join('\n')
	const reader = async () => ({name: 'src/app.ts', text: source})
	const location: any = {artifactLocation: {uri: 'src/app.ts'}, region: {startLine: 2}}

	await openSourceFile(
		location.artifactLocation,
		{} as any,
		location.region,
		reader,
		{
			locations: [location],
			activeIndex: 0,
			label: 'Code flow',
			inferIdentifiers: true,
			origin: {
				location: {
					artifactLocation: {uri: 'src/app.ts'},
					region: {startLine: 1, startColumn: 23, endColumn: 27},
				},
				name: 'path',
				kind: 'method-parameter',
			},
		},
	)

	const identifiers = Array.from(childDocument.querySelectorAll('.trace-identifier-highlight'))
	expect(identifiers.map(mark => mark.textContent)).toEqual(['path', 'path'])
	expect(childDocument.querySelectorAll('.trace-badge')).toHaveLength(1)
	open.mockRestore()
})

test('does not propagate an identifier that occupies a declaration type position', async () => {
	const childDocument = document.implementation.createHTMLDocument()
	const childWindow = {document: childDocument, opener: window, location: {hash: ''}} as any as Window
	const open = jest.spyOn(window, 'open').mockReturnValue(childWindow)
	const source = [
		'void read(File file) {',
		'  File next = file;',
		'}',
	].join('\n')
	const reader = async () => ({name: 'src/Reader.java', text: source})
	const locations: any[] = [
		{artifactLocation: {uri: 'src/Reader.java'}, region: {startLine: 1, startColumn: 11, endColumn: 15}},
		{artifactLocation: {uri: 'src/Reader.java'}, region: {startLine: 2}},
	]

	await openSourceFile(
		locations[0].artifactLocation,
		{} as any,
		locations[0].region,
		reader,
		{locations, activeIndex: 0, label: 'Code flow', inferIdentifiers: true},
	)

	expect(Array.from(childDocument.querySelectorAll('.trace-identifier-highlight')).map(mark => mark.textContent))
		.not.toContain('File')
	open.mockRestore()
})
