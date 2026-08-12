import {Run} from 'sarif'
import {getRepoUri} from './getRepoUri'

test('builds a GitHub source URL without Node URL polyfills', () => {
	const run = {
		versionControlProvenance: [{
			repositoryUri: 'https://github.com/edmonton/calgary/',
			revisionId: 'abc123',
		}],
	} as Run

	expect(getRepoUri('/src/file.ts', run, {startLine: 7})).toBe(
		'https://github.com/edmonton/calgary/blob/abc123/src/file.ts#L7',
	)
})

test('normalizes Windows artifact separators and rejects lookalike repository hosts', () => {
	const run = {
		versionControlProvenance: [{repositoryUri: 'https://github.com/edmonton/calgary'}],
	} as Run
	expect(getRepoUri('src\\river bank\\file.ts', run)).toBe(
		'https://github.com/edmonton/calgary/blob/main/src/river%20bank/file.ts',
	)
	const lookalike = {
		versionControlProvenance: [{repositoryUri: 'https://notgithub.com/edmonton/calgary'}],
	} as Run
	expect(getRepoUri('src/file.ts', lookalike)).toBeUndefined()
})

test('preserves Azure repository query parameters and sets source coordinates', () => {
	const run = {versionControlProvenance: [{
		repositoryUri: 'https://dev.azure.com/edmonton/river/_git/calgary?_a=contents',
		revisionId: 'abc123',
	}]} as Run
	const result = new URL(getRepoUri('src\\file.ts', run, {startLine: 7, startColumn: 3, endColumn: 9}))
	expect(Object.fromEntries(result.searchParams)).toEqual({
		_a: 'contents', path: '/src/file.ts', version: 'GCabc123', line: '7', lineEnd: '7', lineStartColumn: '3', lineEndColumn: '9',
	})
})
