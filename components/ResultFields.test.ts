import {Log, Result} from 'sarif'
import {buildResultFieldTree, discoverResultFieldPaths, getResultFieldDisplayNames, getResultFieldValue} from './ResultFields'

test('discovers nested scalar fields and ignores viewer back-links', () => {
	const result: any = {
		message: {text: 'Finding'},
		properties: {acah: {classification: 'taint-unverified', status: 'review', resolution: 'native', sink: {selection: {status: 'confirmed'}}}},
		locations: [{physicalLocation: {artifactLocation: {uri: 'src/app.ts'}}}],
	}
	result.run = {properties: {acah: {formatVersion: 3}}, results: [result]}
	result._rule = {id: 'internal'}
	const logs = [{runs: [{...result.run, results: [result]}]}] as Log[]

	const paths = discoverResultFieldPaths(logs)
	expect(paths).toContain('properties.acah.sink.selection.status')
	expect(paths).toContain('locations.physicalLocation.artifactLocation.uri')
	expect(paths.some(path => path.startsWith('run.'))).toBe(false)
	expect(paths.some(path => path.startsWith('_rule.'))).toBe(false)

	const properties = buildResultFieldTree(paths).find(node => node.name === 'properties')
	expect(properties.displayName).toBe('Properties')
	expect(properties.children.find(node => node.name === 'acah')?.displayName).toBe('ACAH')
	expect(properties.children.find(node => node.name === 'acah')?.children.find(node => node.name === 'sink')
		?.children.find(node => node.name === 'selection')?.children[0].path).toBe('properties.acah.sink.selection.status')
})

test('combines values from arrays into one field value', () => {
	const result = {suppressions: [{kind: 'external'}, {kind: 'inSource'}, {kind: 'external'}]} as Result
	expect(getResultFieldValue(result, 'suppressions.kind')).toBe('external, inSource')
})

test('uses shortest unique field suffixes as display names', () => {
	expect(getResultFieldDisplayNames(['properties.acah.sinkFamily'])
		.get('properties.acah.sinkFamily')).toBe('Sink Family')
	const names = getResultFieldDisplayNames([
		'Path',
		'properties.acah.confidence',
		'properties.analysis.confidence',
		'properties.acah.status',
	])
	expect(names.get('Path')).toBe('Path')
	expect(names.get('properties.acah.confidence')).toBe('ACAH Confidence')
	expect(names.get('properties.analysis.confidence')).toBe('Analysis Confidence')
	expect(names.get('properties.acah.status')).toBe('Status')
})
