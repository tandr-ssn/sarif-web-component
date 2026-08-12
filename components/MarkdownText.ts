import {unified} from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import {safeLinkHref} from './SafeLink'

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

function tree(markdown: string): MarkdownNode {
	return unified().use(remarkParse).use(remarkGfm).parse(markdown) as MarkdownNode
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
	return blockText(tree(markdown)).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function safeHref(value: string | undefined): string | undefined {
	const href = safeLinkHref(value)
	return href ? escapeHtml(href) : undefined
}

function inlineHtml(node: MarkdownNode): string {
	const children = (node.children ?? []).map(inlineHtml).join('')
	switch (node.type) {
		case 'text': return escapeHtml(node.value ?? '')
		case 'html': return escapeHtml(node.value ?? '')
		case 'inlineCode': return `<code>${escapeHtml(node.value ?? '')}</code>`
		case 'break': return '<br>'
		case 'emphasis': return `<em>${children}</em>`
		case 'strong': return `<strong>${children}</strong>`
		case 'delete': return `<del>${children}</del>`
		case 'link': {
			const href = safeHref(node.url)
			return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${children}</a>` : children
		}
		case 'image': {
			const label = escapeHtml(node.alt ?? 'Image')
			const href = safeHref(node.url)
			return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>` : label
		}
		default: return children || escapeHtml(node.value ?? '')
	}
}

function tableHtml(node: MarkdownNode): string {
	const rows = node.children ?? []
	return '<table><thead>' + (rows[0] ? `<tr>${(rows[0].children ?? []).map(cell => `<th>${inlineHtml(cell)}</th>`).join('')}</tr>` : '')
		+ '</thead><tbody>' + rows.slice(1).map(row => `<tr>${(row.children ?? []).map(cell => `<td>${inlineHtml(cell)}</td>`).join('')}</tr>`).join('')
		+ '</tbody></table>'
}

function listItemHtml(node: MarkdownNode): string {
	const task = node.checked === true ? '<input type="checkbox" checked disabled> ' : node.checked === false ? '<input type="checkbox" disabled> ' : ''
	return `<li>${task}${(node.children ?? []).map(blockHtml).join('')}</li>`
}

function blockHtml(node: MarkdownNode): string {
	const children = node.children ?? []
	switch (node.type) {
		case 'root': return children.map(blockHtml).join('')
		case 'paragraph': return `<p>${inlineHtml(node)}</p>`
		case 'heading': return `<h${Math.min(6, Math.max(1, (node as any).depth ?? 1))}>${inlineHtml(node)}</h${Math.min(6, Math.max(1, (node as any).depth ?? 1))}>`
		case 'code': return `<pre><code>${escapeHtml(node.value ?? '')}</code></pre>`
		case 'blockquote': return `<blockquote>${children.map(blockHtml).join('')}</blockquote>`
		case 'list': {
			const tag = node.ordered ? 'ol' : 'ul'
			const start = node.ordered && node.start && node.start !== 1 ? ` start="${node.start}"` : ''
			return `<${tag}${start}>${children.map(listItemHtml).join('')}</${tag}>`
		}
		case 'listItem': return listItemHtml(node)
		case 'table': return tableHtml(node)
		case 'thematicBreak': return '<hr>'
		case 'definition': return ''
		default: return children.length ? children.map(blockHtml).join('') : inlineHtml(node)
	}
}

/** Converts CommonMark and GFM syntax into safe, self-contained HTML fragments. */
export function markdownToHtml(markdown: string): string {
	return markdown.trim() ? blockHtml(tree(markdown)) : ''
}
