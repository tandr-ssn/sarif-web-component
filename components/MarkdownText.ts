import unified from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

interface MarkdownNode {
	type: string
	value?: string
	url?: string
	alt?: string
	ordered?: boolean
	start?: number
	checked?: boolean | null
	children?: MarkdownNode[]
}

function inlineText(node: MarkdownNode): string {
	if (['text', 'inlineCode', 'html'].includes(node.type)) return node.value ?? ''
	if (node.type === 'break') return '\n'
	if (node.type === 'image') return node.url ? `${node.alt ?? 'Image'} (${node.url})` : node.alt ?? 'Image'
	const label = (node.children ?? []).map(inlineText).join('')
	if (node.type === 'link' && node.url && label !== node.url) return `${label} (${node.url})`
	return label || node.value || ''
}

function indent(value: string, spaces: number): string {
	const prefix = ' '.repeat(spaces)
	return value.split('\n').map(line => line ? prefix + line : line).join('\n')
}

function tableText(node: MarkdownNode): string {
	const rows = (node.children ?? []).map(row => (row.children ?? []).map(cell => inlineText(cell).trim()))
	const widths = rows.reduce<number[]>((current, row) => row.map((cell, index) =>
		Math.max(current[index] ?? 0, ...cell.split('\n').map(line => line.length))), [])
	return rows.map(row => row.map((cell, index) => cell.padEnd(widths[index])).join(' | ').trimEnd()).join('\n')
}

function listText(node: MarkdownNode): string {
	const start = node.start ?? 1
	return (node.children ?? []).map((item, index) => {
		const marker = node.ordered ? `${start + index}. ` : '- '
		const task = item.checked === true ? '[x] ' : item.checked === false ? '[ ] ' : ''
		const content = (item.children ?? []).map(blockText).filter(Boolean).join('\n')
		const [first = '', ...rest] = content.split('\n')
		return marker + task + first + (rest.length ? `\n${indent(rest.join('\n'), marker.length)}` : '')
	}).join('\n')
}

function blockText(node: MarkdownNode): string {
	switch (node.type) {
		case 'root': return (node.children ?? []).map(blockText).filter(Boolean).join('\n\n')
		case 'paragraph':
		case 'heading': return inlineText(node).trim()
		case 'code': return node.value ?? ''
		case 'blockquote': return (node.children ?? []).map(blockText).filter(Boolean).join('\n').split('\n')
			.map(line => line ? `> ${line}` : '>').join('\n')
		case 'list': return listText(node)
		case 'listItem': return (node.children ?? []).map(blockText).filter(Boolean).join('\n')
		case 'table': return tableText(node)
		case 'thematicBreak': return '────────'
		case 'definition': return ''
		default: return node.children?.length ? node.children.map(blockText).filter(Boolean).join('\n') : inlineText(node)
	}
}

/** Converts CommonMark and GFM syntax into readable text without producing HTML. */
export function markdownToPlainText(markdown: string): string {
	if (!markdown.trim()) return ''
	const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as MarkdownNode
	return blockText(tree).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
