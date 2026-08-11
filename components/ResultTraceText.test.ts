import {Result} from 'sarif'
import {resultDetailsCopyText} from './ResultTraceText'

test('copies a primary context snippet with source line numbers', () => {
	const result = {
		message: {text: 'Finding'},
		locations: [{physicalLocation: {
			artifactLocation: {uri: 'src/app.ts'},
			region: {startLine: 12},
			contextRegion: {startLine: 10, snippet: {text: 'first();\nsecond();\nthird();'}},
		}}],
	} as unknown as Result

	expect(resultDetailsCopyText(result)).toBe([
		'Finding',
		'',
		'src/app.ts:12',
		'10  first();',
		'11  second();',
		'12  third();',
	].join('\n'))
})

test('strips the absolute source-root prefix from copied locations', () => {
	const result = {
		message: {text: 'Finding'},
		locations: [{physicalLocation: {
			artifactLocation: {uri: 'file:///home/user/calgary/composer.lock'},
			region: {startLine: 1, snippet: {text: 'package'}},
		}}],
		run: {versionControlProvenance: [{
			repositoryUri: 'https://example.test/calgary', mappedTo: {uri: 'file:///home/user/calgary/'},
		}]},
	} as unknown as Result

	expect(resultDetailsCopyText(result)).toContain('calgary/composer.lock:1')
	expect(resultDetailsCopyText(result)).not.toContain('/home/user')
})
