import {createResultCsv} from './ResultExport'
import {RunStore} from './RunStore'

const first = {
	path: 'src/one.ts',
	message: 'First, finding\nconst value = "quoted"',
	codeFlows: [{threadFlows: [{locations: [{location: {
		message: {text: 'Input received'},
		physicalLocation: {
			artifactLocation: {uri: 'src/input.ts'},
			region: {startLine: 4, snippet: {text: 'const value = input;\nuse(value);'}},
		},
	}}]}]}],
}
const second = {path: 'src/two.ts', message: '=unsafe formula'}
const runStore = {
	columns: [
		{id: 'Path', filterString: result => result.path},
		{id: 'Details', filterString: result => result.message},
	],
	run: {results: [first, second]},
	filteredResults: [second],
} as unknown as RunStore

test('exports all findings using the selected fields', () => {
	expect(createResultCsv([runStore], 'all')).toBe(
		'\ufeff"Path","Details","Code flow"\r\n' +
		'"src/one.ts","First, finding\nconst value = ""quoted""","1. Input received — src/input.ts:4\n' +
		'const value = input;\nuse(value);"\r\n' +
		'"src/two.ts","\'=unsafe formula",""')
})

test('exports only currently filtered findings', () => {
	expect(createResultCsv([runStore], 'filtered')).toBe(
		'\ufeff"Path","Details"\r\n' +
		'"src/two.ts","\'=unsafe formula"')
})
