import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import {Result} from 'sarif'
import {ExecutionTrace} from './ExecutionTrace'
import {SourceLocationLink} from './SourceLocationLink'
import {Snippet} from './Snippet'

Enzyme.configure({ adapter: new Adapter() })

test('renders result stacks and code flows', () => {
	const run: any = {
		threadFlowLocations: [{
			location: {
				message: { text: 'Enter handler' },
				physicalLocation: {
					artifactLocation: { uri: 'src/handler.ts' },
					region: { startLine: 5, snippet: {text: 'handle(request)'} },
				},
			},
		}],
	}
	const result = {
		run,
		message: { text: 'Finding' },
		properties: {audit: {origin: {
			kind: 'method-parameter',
			name: 'request',
			location: {path: 'src/handler.ts', line: 5, column: 8},
		}}},
		stacks: [{
			frames: [{
				module: 'app',
				location: {
					logicalLocations: [{ fullyQualifiedName: 'App.Run' }],
					physicalLocation: { artifactLocation: { uri: 'src/app.ts' }, region: { startLine: 10, snippet: {text: 'Run(path)'} } },
				},
			}],
		}],
		codeFlows: [{ threadFlows: [{ locations: [{ index: 0 }] }] }],
	} as unknown as Result
	const origin = {
		location: {
			artifactLocation: {uri: 'src/handler.ts'},
			region: {startLine: 5, startColumn: 8, endColumn: 15},
		},
		name: 'request',
		kind: 'method-parameter',
	}

	const wrapper = mount(<ExecutionTrace result={result} />)
	expect(wrapper.find('summary').map(summary => summary.text())).toEqual([
		'Call stack (1 frames)',
		'Code flow',
	])
	expect(wrapper.find('details').map(details => details.prop('data-copy-trace-value'))).toEqual([
		'1. App.Run — src/app.ts:10\n10  Run(path)',
		'1. Enter handler — src/handler.ts:5\n5  handle(request)',
	])
	expect(wrapper.text()).toContain('App.Run')
	expect(wrapper.text()).toContain('src/app.ts:10')
	expect(wrapper.text()).toContain('Enter handler')
	expect(wrapper.text()).toContain('src/handler.ts:5')
	expect(wrapper.find('.swcSnippet').map(snippet => snippet.text()).join(' ')).toContain('handle(request)')
	expect(wrapper.find(Snippet).map(snippet => snippet.prop('highlightColor'))).toEqual(['#bde3f4', '#bde3f4'])
	const sourceLinks = wrapper.find(SourceLocationLink).filterWhere(link => link.prop('className') !== 'swcSnippetLink')
	expect(sourceLinks.at(0).prop('trace')).toEqual({
		locations: [result.stacks[0].frames[0].location.physicalLocation],
		activeIndex: 0,
		label: 'Call stack',
		origin,
	})
	expect(sourceLinks.at(1).prop('trace')).toEqual({
		locations: [run.threadFlowLocations[0].location.physicalLocation],
		activeIndex: 0,
		label: 'Code flow',
		inferIdentifiers: true,
		origin,
	})
	const snippetLinks = wrapper.find(SourceLocationLink).filterWhere(link => link.prop('className') === 'swcSnippetLink')
	expect(snippetLinks).toHaveLength(2)
	expect(snippetLinks.at(1).prop('trace')).toEqual(sourceLinks.at(1).prop('trace'))
})
