import {Result} from 'sarif'
import {getResultAuditOrigin, getResultSourceTrace} from './ResultSourceTrace'

test('converts audit origin metadata into an exact source identifier', () => {
	const result = {
		properties: {audit: {origin: {
			kind: 'method-parameter',
			name: 'filePath',
			location: {path: 'src/file.ts', line: 12, column: 50},
		}}},
	} as unknown as Result

	expect(getResultAuditOrigin(result)).toEqual({
		location: {
			artifactLocation: {uri: 'src/file.ts'},
			region: {startLine: 12, startColumn: 50, endColumn: 58},
		},
		name: 'filePath',
		kind: 'method-parameter',
	})
})

test('uses a code flow and appends the primary result location', () => {
	const flowLocation: any = {artifactLocation: {uri: 'src/start.ts'}, region: {startLine: 2}}
	const primary: any = {artifactLocation: {uri: 'src/end.ts'}, region: {startLine: 9}}
	const result = {
		run: {threadFlowLocations: [{location: {physicalLocation: flowLocation}}]},
		locations: [{physicalLocation: primary}],
		codeFlows: [{threadFlows: [{locations: [{index: 0}]}]}],
	} as Result

	expect(getResultSourceTrace(result)).toEqual({
		locations: [flowLocation, primary],
		activeIndex: 1,
		label: 'Code flow',
		inferIdentifiers: true,
	})
})

test('falls back to the first call stack', () => {
	const primary: any = {artifactLocation: {uri: 'src/end.ts'}, region: {startLine: 9}}
	const result = {
		run: {},
		locations: [{physicalLocation: primary}],
		stacks: [{frames: [{location: {physicalLocation: primary}}]}],
	} as Result

	expect(getResultSourceTrace(result)).toEqual({locations: [primary], activeIndex: 0, label: 'Call stack'})
})
