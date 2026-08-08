const attribute = 'data-swc-tooltip'
const installed = new WeakSet<Document>()

const styleText = `
.swcTooltip {
	background: #252525;
	border: 1px solid #707070;
	border-radius: 4px;
	box-shadow: 0 3px 10px rgb(0 0 0 / 30%);
	color: #ffffff;
	font: 16px/1.45 Arial, sans-serif;
	max-width: min(640px, calc(100vw - 20px));
	padding: 8px 10px;
	pointer-events: none;
	position: fixed;
	white-space: pre-wrap;
	z-index: 10000;
}`

/** Installs one delegated, consistently styled tooltip layer in a browser window. */
export function installTooltips(target: Window): void {
	const document = target.document
	if (installed.has(document)) return
	installed.add(document)

	const style = document.createElement('style')
	style.textContent = styleText
	document.head.appendChild(style)

	const tooltip = document.createElement('div')
	tooltip.className = 'swcTooltip'
	tooltip.setAttribute('role', 'tooltip')
	tooltip.hidden = true
	document.body.appendChild(tooltip)
	let anchor: Element | undefined

	const owner = (eventTarget: EventTarget | null): Element | undefined =>
		(eventTarget as Element | null)?.closest?.(`[${attribute}]`) ?? undefined
	const hide = (candidate?: Element) => {
		if (candidate && anchor !== candidate) return
		tooltip.hidden = true
		anchor = undefined
	}
	const show = (candidate: Element | undefined) => {
		const value = candidate?.getAttribute(attribute)
		if (!candidate || !value) return hide()
		anchor = candidate
		tooltip.textContent = value
		tooltip.hidden = false
		const anchorBounds = candidate.getBoundingClientRect()
		const tooltipBounds = tooltip.getBoundingClientRect()
		const viewportWidth = target.innerWidth || document.documentElement.clientWidth || 1024
		const viewportHeight = target.innerHeight || document.documentElement.clientHeight || 768
		const gap = 6
		const edge = 10
		tooltip.style.left = `${Math.max(edge, Math.min(anchorBounds.left, viewportWidth - tooltipBounds.width - edge))}px`
		const below = anchorBounds.bottom + gap
		tooltip.style.top = `${below + tooltipBounds.height <= viewportHeight - edge
			? below
			: Math.max(edge, anchorBounds.top - tooltipBounds.height - gap)}px`
	}

	document.addEventListener('mouseover', event => show(owner(event.target)))
	document.addEventListener('mouseout', event => {
		const candidate = owner(event.target)
		if (!candidate || !event.relatedTarget || !candidate.contains(event.relatedTarget as Node)) hide(candidate)
	})
	document.addEventListener('focusin', event => show(owner(event.target)))
	document.addEventListener('focusout', event => {
		const candidate = owner(event.target)
		if (!candidate || !event.relatedTarget || !candidate.contains(event.relatedTarget as Node)) hide(candidate)
	})
	target.addEventListener?.('scroll', () => hide(), true)
	target.addEventListener?.('resize', () => hide())
}
