const attribute = 'data-swc-tooltip'
const installed = new WeakSet<Document>()
const hoverDelay = 600
let tooltipId = 0

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
	z-index: 2147483647;
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
	tooltip.id = `swc-tooltip-${tooltipId++}`
	tooltip.setAttribute('role', 'tooltip')
	tooltip.hidden = true
	document.body.appendChild(tooltip)
	let anchor: Element | undefined
	let pendingAnchor: Element | undefined
	let hoverTimer: number | undefined
	let previousDescribedBy: string | null = null

	const owner = (eventTarget: EventTarget | null): Element | undefined =>
		(eventTarget as Element | null)?.closest?.(`[${attribute}]`) ?? undefined
	const cancelPending = (candidate?: Element) => {
		if (candidate && pendingAnchor !== candidate) return
		if (hoverTimer !== undefined) target.clearTimeout(hoverTimer)
		hoverTimer = undefined
		pendingAnchor = undefined
	}
	const hide = (candidate?: Element) => {
		cancelPending(candidate)
		if (candidate && anchor !== candidate) return
		tooltip.hidden = true
		if (anchor) {
			if (previousDescribedBy === null) anchor.removeAttribute('aria-describedby')
			else anchor.setAttribute('aria-describedby', previousDescribedBy)
		}
		anchor = undefined
		previousDescribedBy = null
	}
	const show = (candidate: Element | undefined) => {
		cancelPending()
		const value = candidate?.getAttribute(attribute)
		if (!candidate || !value) return hide()
		anchor = candidate
		previousDescribedBy = candidate.getAttribute('aria-describedby')
		candidate.setAttribute('aria-describedby', [previousDescribedBy, tooltip.id].filter(Boolean).join(' '))
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
	const showAfterDelay = (candidate: Element | undefined) => {
		if (!candidate?.getAttribute(attribute)) return hide()
		if (candidate === anchor) return
		cancelPending()
		pendingAnchor = candidate
		hoverTimer = target.setTimeout(() => {
			if (pendingAnchor === candidate) show(candidate)
		}, hoverDelay)
	}

	document.addEventListener('mouseover', event => {
		const candidate = owner(event.target)
		// Delegated mouseover bubbles again while moving among descendants. Only a
		// genuine entry starts the delay, but every newly entered owner gets a fresh timer.
		if (candidate !== owner(event.relatedTarget)) showAfterDelay(candidate)
	})
	document.addEventListener('mouseout', event => {
		const candidate = owner(event.target)
		if (candidate !== owner(event.relatedTarget)) hide(candidate)
	})
	document.addEventListener('focusin', event => show(owner(event.target)))
	document.addEventListener('focusout', event => {
		const candidate = owner(event.target)
		if (!candidate || !event.relatedTarget || !candidate.contains(event.relatedTarget as Node)) hide(candidate)
	})
	target.addEventListener?.('scroll', () => hide(), true)
	target.addEventListener?.('resize', () => hide())
}
