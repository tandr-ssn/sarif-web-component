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
