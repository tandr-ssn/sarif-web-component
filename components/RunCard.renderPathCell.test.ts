import {render} from '@testing-library/react'
import * as React from 'react'
import { renderPathCell } from './RunCard.renderPathCell'
import { demoResults } from './PathCellDemo'
import {Result} from 'sarif'
import {SourcePathFormatterContext} from './SourceFile'
import {FilterKeywordContext} from './Viewer.Contexts'

test('renders supported path shapes without failing', () => {
	for (const result of demoResults()) {
		expect(() => render(React.createElement(React.Fragment, null, renderPathCell(result)))).not.toThrow()
	}
})

test('highlights a matching keyword in a rendered path', () => {
	const result = {
		message: {text: 'Finding'},
		locations: [{physicalLocation: {artifactLocation: {uri: 'src/River/Handler.ts'}}}],
		run: {},
	} as unknown as Result
	const {container} = render(React.createElement(
		FilterKeywordContext.Provider,
		{value: 'river'},
		renderPathCell(result),
	))

	expect(container.querySelector('mark')?.textContent).toBe('River')
})

test('renders an embedded, middle-ellipsized path with its source position', () => {
	const result = {
		message: {text: 'Finding'},
		locations: [{physicalLocation: {
			artifactLocation: {uri: 'src/features/deep/Handler.cs'},
			region: {startLine: 42, startColumn: 7},
		}}],
		run: {},
	} as unknown as Result
	const {container} = render(React.createElement(React.Fragment, null, renderPathCell(result, true)))

	const path = container.querySelector<HTMLElement>('div.swcFindingPath')
	expect(path?.dataset.swcTooltip).toBe('src/features/deep/Handler.cs:42:7')
	expect(path?.textContent).toBe('src/features/deep/Handler.cs:42:7')
})

test('updates the displayed path when the selected source root changes', () => {
	const result = {
		message: {text: 'Finding'},
		locations: [{physicalLocation: {
			artifactLocation: {uri: '/home/user/calgary/src/Handler.cs'},
			region: {startLine: 42},
		}}],
		run: {},
	} as unknown as Result
	const RootedPath = (props: {root: string}) => React.createElement(SourcePathFormatterContext.Provider, {
		value: () => `${props.root}/${props.root === 'calgary' ? 'src/' : ''}Handler.cs`,
	}, renderPathCell(result, true))
	const {container, rerender} = render(React.createElement(RootedPath, {root: 'calgary'}))
	const displayedPath = () => container.querySelector('.swcFindingPath')?.textContent

	expect(displayedPath()).toBe('calgary/src/Handler.cs:42')
	rerender(React.createElement(RootedPath, {root: 'src'}))
	expect(displayedPath()).toBe('src/Handler.cs:42')
	expect(container.querySelector<HTMLElement>('div.swcFindingPath')?.dataset.swcTooltip).toBe('src/Handler.cs:42')
})

test('does not treat an artifact description as a root-relative path', () => {
	const result = {
		message: {text: 'Finding'},
		locations: [{physicalLocation: {
			artifactLocation: {uri: '/home/user/calgary/src/Handler.cs', description: {text: 'Calgary service handler'}},
			region: {startLine: 42},
		}}],
		run: {},
	} as unknown as Result
	const {container} = render(React.createElement(SourcePathFormatterContext.Provider, {
		value: () => 'calgary/src/Handler.cs',
	}, renderPathCell(result, true)))
	expect(container.querySelector('.swcFindingPath')?.textContent).toBe('Calgary service handler:42')
})

test('resolves an index-only result location while keeping display text separate from its URI', () => {
	const result = {
		message: {text: 'Finding'},
		locations: [{physicalLocation: {artifactLocation: {index: 0}, region: {startLine: 9}}}],
		run: {artifacts: [{
			description: {text: 'River request handler'},
			location: {uri: 'src/River.ts', properties: {href: 'https://example.test/src/River.ts'}},
		}]},
	} as unknown as Result
	const {container} = render(React.createElement(React.Fragment, null, renderPathCell(result, true)))
	const path = container.querySelector<HTMLElement>('.swcFindingPath')

	expect(path?.textContent).toBe('River request handler:9')
	expect(path?.dataset.swcTooltip).toBe('src/River.ts:9')
	expect(container.querySelector('a')?.href).toBe('https://example.test/src/River.ts')
})
