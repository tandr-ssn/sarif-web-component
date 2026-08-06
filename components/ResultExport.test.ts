import {createResultCsv} from './ResultExport'
import {RunStore} from './RunStore'

const first = {path: 'src/one.ts', message: 'First, finding'}
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
		'\ufeff"Path","Details"\r\n' +
		'"src/one.ts","First, finding"\r\n' +
		'"src/two.ts","\'=unsafe formula"')
})

test('exports only currently filtered findings', () => {
	expect(createResultCsv([runStore], 'filtered')).toBe(
		'\ufeff"Path","Details"\r\n' +
		'"src/two.ts","\'=unsafe formula"')
})
