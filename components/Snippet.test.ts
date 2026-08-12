import {getSnippetRegionSegments, trimSnippetIndent} from './Snippet'

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

test('maps a character-offset region through CRLF normalization and indentation trimming', () => {
	const text = '    first();\r\n      selected();\r\n    last();'
	const selectedOffset = text.indexOf('selected')
	expect(getSnippetRegionSegments(
		{charOffset: 100 + selectedOffset, charLength: 'selected'.length},
		{charOffset: 100, snippet: {text}},
	)).toEqual({
		pre: 'first();\n  ',
		highlighted: 'selected',
		post: '();\nlast();',
	})
})

test('retains line and column highlighting after indentation trimming', () => {
	expect(getSnippetRegionSegments(
		{startLine: 11, startColumn: 5, endLine: 11, endColumn: 13},
		{startLine: 10, startColumn: 1, snippet: {text: '    before();\n    selected();\n    after();'}},
	)).toEqual({pre: 'before();\n', highlighted: 'selected', post: '();\nafter();'})
})
