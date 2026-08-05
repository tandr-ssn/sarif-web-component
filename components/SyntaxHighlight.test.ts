import {highlightSourceSegment} from './SyntaxHighlight'

test('highlights supported source without treating source text as markup', () => {
	const highlighted = highlightSourceSegment('const value = "<script>"', 'src/file.ts')
	expect(highlighted).toContain('<span class="hljs-keyword">const</span>')
	expect(highlighted).toContain('&lt;script&gt;')
})

test('leaves unknown file types for plain-text rendering', () => {
	expect(highlightSourceSegment('plain text', 'README.unknown')).toBeUndefined()
})
