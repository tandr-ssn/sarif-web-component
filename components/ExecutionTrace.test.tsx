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
		properties: {acah: {formatVersion: 3}},
		threadFlowLocations: [{
			location: {
				message: { text: 'Enter handler' },
				physicalLocation: {
					artifactLocation: { uri: 'src/handler.ts' },
					region: { startLine: 5, snippet: {text: 'handle(request)'} },
				},
			},
			properties: {acah: {role: 'boundary', symbol: 'request', resolution: 'semantic'}},
		}],
	}
	const result = {
		run,
		message: { text: 'Finding' },
	properties: {acah: {
		classification: 'taint-unverified', status: 'review', resolution: 'native',
		origin: {
			kind: 'method-parameter',
			name: 'request',
			location: {path: 'src/handler.ts', line: 5, column: 8},
		},
		trace: {
			status: 'partial',
			scope: 'construction-to-sink',
			reason: 'Caller origin is unresolved',
		},
	}},
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
		'Code flow (1 step) · Partial',
	])
	expect(wrapper.find('.swcTraceStatus').prop('title')).toBe([
		"Partial trace within ACAH's bounded static model · Construction to sink",
		'This does not prove runtime reachability or exploitability.',
		'Caller origin is unresolved',
	].join('\n'))
	expect(wrapper.find('details').map(details => details.prop('data-copy-trace-value'))).toEqual([
		'1. App.Run — src/app.ts:10\n10  Run(path)',
		'1. Enter handler — src/handler.ts:5\n5  handle(request)',
	])
	expect(wrapper.text()).toContain('App.Run')
	expect(wrapper.text()).toContain('src/app.ts:10')
	expect(wrapper.text()).toContain('Enter handler')
	expect(wrapper.text()).toContain('src/handler.ts:5')
	expect(wrapper.find('.swcSnippet').map(snippet => snippet.text()).join(' ')).toContain('handle(request)')
	expect(wrapper.find(Snippet).map(snippet => snippet.prop('highlightColor'))).toEqual(['#bde3f4', '#f7ee9f'])
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
		steps: [run.threadFlowLocations[0]],
		identifierHints: ['request'],
		inferIdentifiers: true,
		origin,
	})
	const snippetLinks = wrapper.find(SourceLocationLink).filterWhere(link => link.prop('className') === 'swcSnippetLink')
	expect(snippetLinks).toHaveLength(2)
	expect(snippetLinks.at(1).prop('trace')).toEqual(sourceLinks.at(1).prop('trace'))
})

test('labels a complete ACAH trace without implying runtime proof', () => {
	const result = {
		run: {properties: {acah: {formatVersion: 3}}},
		properties: {acah: {classification: 'taint-high-confidence', status: 'proven', resolution: 'native',
			trace: {status: 'complete', scope: 'modeled-source-to-sink', reason: 'all modeled endpoints are present'}}},
		codeFlows: [{threadFlows: [{locations: []}]}],
	} as unknown as Result
	const wrapper = mount(<ExecutionTrace result={result} />)
	expect(wrapper.find('summary').text()).toBe('Code flow (0 steps) · Complete')
	expect(wrapper.find('.swcTraceStatus').prop('title')).toContain("Complete trace within ACAH's bounded static model")
	expect(wrapper.find('.swcTraceStatus').prop('title')).toContain('does not prove runtime reachability')
})

test('selects one sink branch while retaining every branch for copy', () => {
	const run: any = {threadFlowLocations: [
		{location: {message: {text: 'Shared source'}, physicalLocation: {artifactLocation: {uri: 'src/input.ts'}, region: {startLine: 2, snippet: {text: 'request.path'}}}}},
		{location: {message: {text: 'Write file'}, physicalLocation: {artifactLocation: {uri: 'src/files.ts'}, region: {startLine: 8, snippet: {text: 'write(path)'}}}}},
		{location: {message: {text: 'Run query'}, physicalLocation: {artifactLocation: {uri: 'src/db.ts'}, region: {startLine: 12, snippet: {text: 'query(sql)'}}}}},
	]}
	const result = {run, locations: [{physicalLocation: run.threadFlowLocations[1].location.physicalLocation}], codeFlows: [
		{message: {text: 'File write'}, threadFlows: [{locations: [{index: 0}, {index: 1}]}]},
		{message: {text: 'SQL execution'}, threadFlows: [{locations: [{index: 0}, {index: 2}]}]},
	]} as unknown as Result
	const wrapper = mount(<ExecutionTrace result={result} />)
	expect(wrapper.find('[role="tab"]').map(tab => tab.text())).toEqual(['File write', 'SQL execution'])
	expect(wrapper.text()).toContain('write(path)')
	expect(wrapper.text()).not.toContain('query(sql)')
	expect(wrapper.find('details').prop('data-copy-trace-value')).toContain('File write')
	expect(wrapper.find('details').prop('data-copy-trace-value')).toContain('SQL execution')
	wrapper.find('[role="tab"]').at(1).simulate('click')
	expect(wrapper.text()).toContain('query(sql)')
	expect(wrapper.text()).not.toContain('write(path)')
})
