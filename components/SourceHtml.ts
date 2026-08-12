/** Escapes untrusted source and SARIF text before inserting it into popup markup. */
export function escapeSourceHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
}

export function sourceDocumentTitle(path: string | undefined, context?: string): string {
	if (!path) return 'Source file'
	let decoded = path
	try { decoded = decodeURIComponent(path) } catch (_) { }
	const file = decoded.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'Source file'
	const compactContext = context?.replace(/\s+/g, ' ').trim()
	return compactContext ? `${file} — ${compactContext.slice(0, 80)}` : file
}

export function sourceLines(text: string): string[] {
	return text.match(/[^\n]*\n|[^\n]+$/g) ?? ['']
}
