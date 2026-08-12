/**
 * Returns a trimmed URL when it is safe to expose as a browser link.
 *
 * SARIF is untrusted input. In particular, never pass javascript: or data:
 * values through to href, even when a producer supplied them as metadata.
 */
export function safeLinkHref(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined
	const href = value.trim()
	if (!href) return undefined
	if (href.startsWith('#') || href.startsWith('/')) return href
	try {
		const url = new URL(href)
		return ['http:', 'https:', 'mailto:'].includes(url.protocol.toLowerCase()) ? href : undefined
	} catch (_) {
		return undefined
	}
}
