import {createResultCsv, createResultMarkdown} from './ResultExport'
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
		'4  const value = input;\n5  use(value);"\r\n' +
		'"src/two.ts","\'=unsafe formula",""')
})

test('exports only currently filtered findings', () => {
	expect(createResultCsv([runStore], 'filtered')).toBe(
		'\ufeff"Path","Details"\r\n' +
		'"src/two.ts","\'=unsafe formula"')
})

test('exports rendered Markdown as readable text in CSV cells', () => {
	const markdownRunStore = {
		columns: [{
			id: 'rule.help.text',
			filterString: () => '### Versions\n\n| Version | Status |\n| --- | --- |\n| 1.0 | **affected** |',
		}],
		run: {results: [{}]},
		filteredResults: [],
	} as unknown as RunStore

	expect(createResultCsv([markdownRunStore], 'all', 'plain')).toBe(
		'\ufeff"rule.help.text"\r\n"Versions\n\nVersion | Status\n1.0     | affected"')
	expect(createResultCsv([markdownRunStore], 'all', 'raw')).toContain('| --- | --- |')
})

test('exports selected fields as a Markdown report without flattening Markdown values', () => {
	const markdownRunStore = {
		columns: [
			{id: 'result.message.text', filterString: () => 'Calgary.Package 1.0.0'},
			{id: 'rule.help.text', filterString: () => '### Remediation\n\n| Version | Status |\n| --- | --- |\n| 1.0 | affected |'},
			{id: 'rule.helpUri', filterString: () => 'https://example.test/advisory'},
		],
		run: {results: [{}]},
		filteredResults: [],
	} as unknown as RunStore

	expect(createResultMarkdown([markdownRunStore], 'all')).toBe(
		'# SARIF findings\n\n' +
		'## Finding 1\n\n' +
		'### result\\.message\\.text\n\n' +
		'Calgary\\.Package 1\\.0\\.0\n\n' +
		'### rule\\.help\\.text\n\n' +
		'### Remediation\n\n| Version | Status |\n| --- | --- |\n| 1.0 | affected |\n\n' +
		'### rule\\.helpUri\n\n' +
		'<https://example.test/advisory>\n')
})
