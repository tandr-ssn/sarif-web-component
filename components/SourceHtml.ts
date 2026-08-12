/** Escapes untrusted source and SARIF text before inserting it into popup markup. */
export function escapeSourceHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
}

export function sourceDocumentTitle(path: string | undefined): string {
	if (!path) return 'Source file'
	let decoded = path
	try { decoded = decodeURIComponent(path) } catch (_) { }
	return decoded.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'Source file'
}

export function sourceLines(text: string): string[] {
	return text.match(/[^\n]*\n|[^\n]+$/g) ?? ['']
}
