import {Log, Result} from 'sarif'
import {buildResultFieldTree, discoverResultFieldPaths, getResultFieldDisplayNames, getResultFieldJsonPath, getResultFieldValue} from './ResultFields'

test('discovers nested scalar fields and ignores viewer back-links', () => {
	const result: any = {
		message: {text: 'Finding'},
		properties: {acah: {classification: 'taint-unverified', status: 'review', resolution: 'native', sink: {selection: {status: 'confirmed'}}}},
		locations: [{physicalLocation: {artifactLocation: {uri: 'src/app.ts'}}}],
		ruleId: 'river-rule',
		sla: 'Within SLA',
		actions: [{text: 'Internal action', linkUrl: 'https://example.test/internal'}],
	}
	const riverRule: any = {id: 'river-rule', shortDescription: {text: 'River advisory'},
		fullDescription: {text: 'A longer advisory description.'}, help: {markdown: 'Update the affected package.'},
		helpUri: 'https://example.test/CVE-2099-1000'}
	riverRule.isRule = true
	riverRule.results = [result]
	riverRule.treeItem = {childItems: [{data: result}], childItemsAll: [{data: result}]}
	result.run = {
		tool: {driver: {name: 'River', rules: [riverRule]}},
		properties: {acah: {formatVersion: 3}},
		results: [result],
	}
	result._rule = {id: 'internal'}
	const logs = [{runs: [{...result.run, results: [result]}]}] as Log[]

	const paths = discoverResultFieldPaths(logs)
	expect(paths).toContain('result.properties.acah.sink.selection.status')
	expect(paths).toContain('result.message.text')
	expect(paths).toContain('result.locations.physicalLocation.artifactLocation.uri')
	expect(paths).toContain('rule.shortDescription.text')
	expect(paths).toContain('rule.fullDescription.text')
	expect(paths).toContain('rule.help.markdown')
	expect(paths).toContain('rule.helpUri')
	expect(paths.some(path => path.startsWith('result.run.'))).toBe(false)
	expect(paths.some(path => path.startsWith('result._rule.'))).toBe(false)
	expect(paths.some(path => path.startsWith('result.actions.'))).toBe(false)
	expect(paths).not.toContain('result.sla')
	expect(paths.some(path => path.includes('childItems'))).toBe(false)
	expect(paths.some(path => path.startsWith('rule.results.'))).toBe(false)
	expect(paths).not.toContain('rule.isRule')

	const resultNode = buildResultFieldTree(paths).find(node => node.name === 'result')
	const properties = resultNode.children.find(node => node.name === 'properties')
	expect(properties.displayName).toBe('Properties')
	expect(properties.children.find(node => node.name === 'acah')?.displayName).toBe('ACAH')
	expect(properties.children.find(node => node.name === 'acah')?.children.find(node => node.name === 'sink')
		?.children.find(node => node.name === 'selection')?.children[0].path).toBe('result.properties.acah.sink.selection.status')
})

test('combines values from arrays into one field value', () => {
	const result = {suppressions: [{kind: 'external'}, {kind: 'inSource'}, {kind: 'external'}]} as Result
	expect(getResultFieldValue(result, 'result.suppressions.kind')).toBe('external, inSource')
})

test('reads fields from the rule associated with a result', () => {
	const result = {_rule: {
		shortDescription: {text: 'Package advisory'},
		help: {markdown: 'Upgrade to the fixed release.'},
		helpUri: 'https://example.test/CVE-2099-2000',
	}} as unknown as Result
	expect(getResultFieldValue(result, 'rule.shortDescription.text')).toBe('Package advisory')
	expect(getResultFieldValue(result, 'rule.help.markdown')).toBe('Upgrade to the fixed release.')
	expect(getResultFieldValue(result, 'rule.helpUri')).toBe('https://example.test/CVE-2099-2000')
})

test('formats full SARIF JSON paths for result and rule fields', () => {
	expect(getResultFieldJsonPath('result.message.text')).toBe('$.runs[*].results[*].message.text')
	expect(getResultFieldJsonPath('rule.help.markdown')).toBe('$.runs[*].tool.driver.rules[*].help.markdown')
})

test('uses shortest unique field suffixes as display names', () => {
	expect(getResultFieldDisplayNames(['result.properties.acah.sinkFamily'])
		.get('result.properties.acah.sinkFamily')).toBe('Sink Family')
	const names = getResultFieldDisplayNames([
		'Path',
		'result.properties.acah.confidence',
		'result.properties.analysis.confidence',
		'result.properties.acah.status',
		'rule.shortDescription.text',
		'result.message.text',
	])
	expect(names.get('Path')).toBe('Path')
	expect(names.get('result.properties.acah.confidence')).toBe('ACAH Confidence')
	expect(names.get('result.properties.analysis.confidence')).toBe('Analysis Confidence')
	expect(names.get('result.properties.acah.status')).toBe('Status')
	expect(names.get('rule.shortDescription.text')).toBe('Short Description Text')
	expect(names.get('result.message.text')).toBe('Message Text')
})
