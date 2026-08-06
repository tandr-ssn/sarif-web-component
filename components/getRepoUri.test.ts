import {Run} from 'sarif'
import {getRepoUri} from './getRepoUri'

test('builds a GitHub source URL without Node URL polyfills', () => {
	const run = {
		versionControlProvenance: [{
			repositoryUri: 'https://github.com/example/project/',
			revisionId: 'abc123',
		}],
	} as Run

	expect(getRepoUri('/src/file.ts', run, {startLine: 7})).toBe(
		'https://github.com/example/project/blob/abc123/src/file.ts#L7',
	)
})
