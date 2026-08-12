import {fireEvent, render, screen} from '@testing-library/react'
import * as React from 'react'
import {Result} from 'sarif'
import {ExecutionTrace} from './ExecutionTrace'

const sourceLinkProps: any[] = []
const snippetProps: any[] = []

jest.mock('./SourceLocationLink', () => {
	const actual = jest.requireActual('./SourceLocationLink')
	const React = require('react')
	return {...actual, SourceLocationLink: (props: any) => {
		sourceLinkProps.push(props)
		return React.createElement('span', {className: props.className}, actual.getSourceLocationText(props.ploc, props.run))
	}}
})

jest.mock('./Snippet', () => {
	const React = require('react')
	return {Snippet: (props: any) => {
		snippetProps.push(props)
		const text = props.ploc?.contextRegion?.snippet?.text ?? props.ploc?.region?.snippet?.text ?? ''
		return React.createElement('pre', {className: 'swcSnippet'}, text)
	}}
})

beforeEach(() => {
	sourceLinkProps.length = 0
	snippetProps.length = 0
})

test('renders result stacks and code flows', () => {
	const run: any = {
		properties: {acah: {formatVersion: 4}},
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

	const {container} = render(<ExecutionTrace result={result} />)
	expect(Array.from(container.querySelectorAll('summary')).map(summary => summary.textContent)).toEqual([
		'Call stack (1 frames)',
		'Code flow (1 step) · Partial',
	])
	expect(container.querySelector<HTMLElement>('.swcTraceStatus')?.dataset.swcTooltip).toBe([
		"Partial trace within ACAH's bounded static model · Construction to sink",
		'This does not prove runtime reachability or exploitability.',
		'Caller origin is unresolved',
	].join('\n'))
	expect(Array.from(container.querySelectorAll<HTMLElement>('details')).map(details => details.dataset.copyTraceValue)).toEqual([
		'1. App.Run — src/app.ts:10\n10  Run(path)',
		'1. Enter handler — src/handler.ts:5\n5  handle(request)',
	])
	expect(container.textContent).toContain('App.Run')
	expect(container.textContent).toContain('src/app.ts:10')
	expect(container.textContent).toContain('Enter handler')
	expect(container.textContent).toContain('src/handler.ts:5')
	expect(Array.from(container.querySelectorAll('.swcSnippet')).map(snippet => snippet.textContent).join(' ')).toContain('handle(request)')
	expect(snippetProps.map(snippet => snippet.highlightColor)).toEqual(['#bde3f4', '#f7ee9f'])
	expect(sourceLinkProps[0].trace).toEqual({
		locations: [result.stacks[0].frames[0].location.physicalLocation],
		activeIndex: 0,
		label: 'Call stack',
		origin,
	})
	expect(sourceLinkProps[1].trace).toEqual({
		locations: [run.threadFlowLocations[0].location.physicalLocation],
		activeIndex: 0,
		label: 'Code flow',
		steps: [run.threadFlowLocations[0]],
		identifierHints: ['request'],
		inferIdentifiers: true,
		origin,
	})
	expect(snippetProps).toHaveLength(2)
	expect(snippetProps[1].trace).toEqual(sourceLinkProps[1].trace)
})

test('labels a complete ACAH trace without implying runtime proof', () => {
	const result = {
		run: {properties: {acah: {formatVersion: 4}}},
		properties: {acah: {classification: 'taint-high-confidence', status: 'proven', resolution: 'native',
			trace: {status: 'complete', scope: 'modeled-source-to-sink', reason: 'all modeled endpoints are present'}}},
		codeFlows: [{threadFlows: [{locations: []}]}],
	} as unknown as Result
	const {container} = render(<ExecutionTrace result={result} />)
	expect(container.querySelector('summary')?.textContent).toBe('Code flow (0 steps) · Complete')
	expect(container.querySelector<HTMLElement>('.swcTraceStatus')?.dataset.swcTooltip).toContain("Complete trace within ACAH's bounded static model")
	expect(container.querySelector<HTMLElement>('.swcTraceStatus')?.dataset.swcTooltip).toContain('does not prove runtime reachability')
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
	const {container} = render(<ExecutionTrace result={result} />)
	expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['File write', 'SQL execution'])
	expect(container.textContent).toContain('write(path)')
	expect(container.textContent).not.toContain('query(sql)')
	expect(container.querySelector<HTMLElement>('details')?.dataset.copyTraceValue).toContain('File write')
	expect(container.querySelector<HTMLElement>('details')?.dataset.copyTraceValue).toContain('SQL execution')
	fireEvent.click(screen.getByRole('tab', {name: 'SQL execution'}))
	expect(container.textContent).toContain('query(sql)')
	expect(container.textContent).not.toContain('write(path)')
})
