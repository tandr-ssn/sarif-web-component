import {Log, Result} from 'sarif'
import {buildResultFieldTree, discoverResultFieldPaths, getResultFieldDisplayNames, getResultFieldValue} from './ResultFields'

test('discovers nested scalar fields and ignores viewer back-links', () => {
	const result: any = {
		message: {text: 'Finding'},
		properties: {audit: {selection: {status: 'reviewed'}}},
		locations: [{physicalLocation: {artifactLocation: {uri: 'src/app.ts'}}}],
	}
	result.run = {results: [result]}
	result._rule = {id: 'internal'}
	const logs = [{runs: [{results: [result]}]}] as Log[]

	const paths = discoverResultFieldPaths(logs)
	expect(paths).toContain('properties.audit.selection.status')
	expect(paths).toContain('locations.physicalLocation.artifactLocation.uri')
	expect(paths.some(path => path.startsWith('run.'))).toBe(false)
	expect(paths.some(path => path.startsWith('_rule.'))).toBe(false)

	const properties = buildResultFieldTree(paths).find(node => node.name === 'properties')
	expect(properties.children[0].children[0].children[0].path).toBe('properties.audit.selection.status')
})

test('combines values from arrays into one field value', () => {
	const result = {suppressions: [{kind: 'external'}, {kind: 'inSource'}, {kind: 'external'}]} as Result
	expect(getResultFieldValue(result, 'suppressions.kind')).toBe('external, inSource')
})

test('uses shortest unique field suffixes as display names', () => {
	expect(getResultFieldDisplayNames(['properties.audit.confidence'])
		.get('properties.audit.confidence')).toBe('Confidence')
	const names = getResultFieldDisplayNames([
		'Path',
		'properties.audit.confidence',
		'properties.analysis.confidence',
		'properties.audit.status',
	])
	expect(names.get('Path')).toBe('Path')
	expect(names.get('properties.audit.confidence')).toBe('Audit Confidence')
	expect(names.get('properties.analysis.confidence')).toBe('Analysis Confidence')
	expect(names.get('properties.audit.status')).toBe('Status')
})
