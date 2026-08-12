import {createResultCsv, createResultHtml, createResultHtmlTable, createResultMarkdown, createResultText, createResultTsv} from './ResultExport'
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
	visibleResults: [first, second],
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

test('exports selected logical columns as an HTML table', () => {
	const html = createResultHtmlTable([runStore], 'all')
	expect(html).toContain('<table class="findings"><thead><tr><th>Path</th><th>Details</th><th>Code flow</th></tr></thead>')
	expect(html).toContain('<tbody><tr><td><pre>src/one.ts</pre></td><td><pre>First, finding\nconst value = &quot;quoted&quot;</pre></td>')
	expect(html).toContain('<tr><td><pre>src/two.ts</pre></td><td><pre>=unsafe formula</pre></td><td><pre></pre></td></tr>')
})

test('exports rendered Markdown as readable text in CSV cells', () => {
	const markdownRunStore = {
		columns: [{
			id: 'rule.help.text',
			filterString: () => '### Versions\n\n| Version | Status |\n| --- | --- |\n| 1.0 | **affected** |',
		}],
		run: {results: [{}]},
		visibleResults: [{}],
		filteredResults: [],
	} as unknown as RunStore

	expect(createResultCsv([markdownRunStore], 'all', 'plain')).toBe(
		'\ufeff"Text"\r\n"Versions\n\nVersion | Status\n1.0     | affected"')
	expect(createResultCsv([markdownRunStore], 'all', 'raw')).toContain('| --- | --- |')
})

test('exports rendered findings as TSV, HTML, and plain text', () => {
	const renderedRunStore = {
		columns: [
			{id: 'result.message.text', filterString: () => 'Calgary.Package 1.0'},
			{id: 'rule.help.text', filterString: () => '### Versions\n\n| Version | Status |\n| --- | --- |\n| 1.0 | **affected** |'},
		],
		run: {results: [{}]},
		visibleResults: [{}],
		filteredResults: [],
	} as unknown as RunStore

	expect(createResultTsv([renderedRunStore], 'all')).toBe(
		'Message Text\tHelp Text\r\nCalgary.Package 1.0\t"Versions\n\nVersion | Status\n1.0     | affected"')
	expect(createResultText([renderedRunStore], 'all')).toContain(
		'Help Text:\n  Versions\n  \n  Version | Status\n  1.0     | affected')
	const html = createResultHtml([renderedRunStore], 'all')
	expect(html).toContain('<h3>Help Text</h3><h3>Versions</h3>')
	expect(html).toContain('<table><thead><tr><th>Version</th><th>Status</th></tr></thead>')
	expect(html).toContain('<strong>affected</strong>')
	const htmlTable = createResultHtmlTable([renderedRunStore], 'all')
	expect(htmlTable).toContain('<thead><tr><th>Message Text</th><th>Help Text</th></tr></thead>')
	expect(htmlTable).toContain('<td><h3>Versions</h3><table>')
})

test('exports selected fields as a Markdown report without flattening Markdown values', () => {
	const markdownRunStore = {
		columns: [
			{id: 'result.message.text', filterString: () => 'Calgary.Package 1.0.0'},
			{id: 'rule.help.text', filterString: () => '### Remediation\n\n| Version | Status |\n| --- | --- |\n| 1.0 | affected |'},
			{id: 'rule.helpUri', filterString: () => 'https://example.test/advisory'},
		],
		run: {results: [{}]},
		visibleResults: [{}],
		filteredResults: [],
	} as unknown as RunStore

	expect(createResultMarkdown([markdownRunStore], 'all')).toBe(
		'# SARIF findings\n\n' +
		'## Finding 1\n\n' +
		'### Message Text\n\n' +
		'Calgary\\.Package 1\\.0\\.0\n\n' +
		'### Help Text\n\n' +
		'### Remediation\n\n| Version | Status |\n| --- | --- |\n| 1.0 | affected |\n\n' +
		'### Help Uri\n\n' +
		'<https://example.test/advisory>\n')
})
