import {buildSourceNavigation} from './SourceNavigation'

test('indexes each finding under every source file in its trace', () => {
	const primary: any = {artifactLocation: {uri: 'src/Calgary.ts'}, region: {startLine: 12}}
	const upstream: any = {artifactLocation: {uri: 'src/Bow.ts'}, region: {startLine: 4}}
	const result: any = {
		ruleId: 'RIVER001',
		message: {text: 'Synthetic flow'},
		fingerprints: {primary: 'stable-river'},
		locations: [{physicalLocation: primary}],
		codeFlows: [{threadFlows: [{locations: [{location: {physicalLocation: upstream}}]}]}],
		_rule: {id: 'RIVER001', shortDescription: {text: 'River validation'}},
	}
	const run: any = {tool: {driver: {name: 'Synthetic'}}, results: [result]}
	result.run = run

	const navigation = buildSourceNavigation([run])

	expect(navigation.byFile.get('src/Calgary.ts')).toHaveLength(1)
	expect(navigation.byFile.get('src/Bow.ts')?.[0].label).toBe('River validation')
	expect(navigation.byLocation.get(upstream)?.id).toBe(navigation.byLocation.get(primary)?.id)
})
