import {trimSnippetIndent} from './Snippet'

test('removes the shortest space indentation and preserves relative indentation', () => {
	expect(trimSnippetIndent('    first\n        second\n      third')).toEqual({
		text: 'first\n    second\n  third',
		removed: 4,
	})
})

test('handles tabs, mixed leading whitespace, blank lines, and CRLF', () => {
	expect(trimSnippetIndent('\t\tfirst\r\n\t\t  second\r\n\r\n\t\t\tthird')).toEqual({
		text: 'first\n  second\n\n\tthird',
		removed: 2,
	})
})

test('leaves an unindented or entirely blank snippet stable', () => {
	expect(trimSnippetIndent('first\n  second').text).toBe('first\n  second')
	expect(trimSnippetIndent('\t\n  \n').text).toBe('\n\n')
})
