import {safeLinkHref} from './SafeLink'

test.each([
	['https://example.test/path', 'https://example.test/path'],
	['http://example.test', 'http://example.test'],
	['mailto:security@example.test', 'mailto:security@example.test'],
	['#source-file-1', '#source-file-1'],
	['/relative/path', '/relative/path'],
	['  https://example.test  ', 'https://example.test'],
])('accepts safe link %s', (value, expected) => {
	expect(safeLinkHref(value)).toBe(expected)
})

test.each([
	'javascript:alert(1)',
	'data:text/html,<script>alert(1)</script>',
	'file:///home/user/private.txt',
	'not a URL',
	'',
])('rejects unsafe link %s', value => {
	expect(safeLinkHref(value)).toBeUndefined()
})
