import {fireEvent, render, screen} from '@testing-library/react'
import * as React from 'react'
import {SourceFileSelectionContext, SourcePathFormatterContext} from './SourceFile'
import {SourceLocationLink} from './SourceLocationLink'

test('explains local folder access before asking for a source folder', () => {
	const selectSourceFiles = jest.fn()
	const run: any = {}
	const ploc: any = {
		artifactLocation: { uri: 'src/file.ts' },
		region: {startLine: 12, startColumn: 7},
	}
	const {container} = render(
		<SourceFileSelectionContext.Provider value={selectSourceFiles}>
			<SourceLocationLink ploc={ploc} run={run} />
		</SourceFileSelectionContext.Provider>,
	)

	const link = container.querySelector<HTMLElement>('a')
	expect(link?.dataset.swcTooltip).toBe('src/file.ts:12:7')
	fireEvent.click(link)
	expect(selectSourceFiles).not.toHaveBeenCalled()
	expect(screen.getByRole('dialog')).toHaveTextContent('Files stay on your computer and are not uploaded')
	fireEvent.click(screen.getByRole('button', {name: 'Choose source folder...'}))
	expect(selectSourceFiles).toHaveBeenCalledTimes(1)
})

test('uses the formatted path in the tooltip without exposing the full local path', () => {
	const run: any = {}
	const ploc: any = {
		artifactLocation: {uri: '/home/user/calgary/src/file.ts', properties: {href: '#source'}},
		region: {startLine: 12, startColumn: 7},
	}
	const {container} = render(
		<SourcePathFormatterContext.Provider value={() => 'calgary/src/file.ts'}>
			<SourceLocationLink ploc={ploc} run={run} />
		</SourcePathFormatterContext.Provider>,
	)

	expect(container.textContent).toBe('calgary/src/file.ts:12:7')
	expect(container.querySelector<HTMLElement>('a')?.dataset.swcTooltip).toBe('calgary/src/file.ts:12:7')
})
