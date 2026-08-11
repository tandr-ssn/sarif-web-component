import {installTooltips} from './Tooltip'

test('shows one large custom tooltip layer for annotated elements', () => {
	installTooltips(window)
	installTooltips(window)
	const anchor = document.createElement('button')
	anchor.setAttribute('data-swc-tooltip', 'Readable details')
	document.body.appendChild(anchor)

	anchor.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}))
	const tooltips = document.querySelectorAll<HTMLElement>('.swcTooltip')
	expect(tooltips).toHaveLength(1)
	expect(tooltips[0].hidden).toBe(false)
	expect(tooltips[0].textContent).toBe('Readable details')
	expect(Array.from(document.querySelectorAll('style')).map(style => style.textContent).join('\n'))
		.toContain('font: 16px/1.45 Arial, sans-serif')
	expect(Array.from(document.querySelectorAll('style')).map(style => style.textContent).join('\n'))
		.toContain('z-index: 2147483647')

	anchor.dispatchEvent(new MouseEvent('mouseout', {bubbles: true}))
	expect(tooltips[0].hidden).toBe(true)
})
