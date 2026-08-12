import {fireEvent, render, screen} from '@testing-library/react'
import * as React from 'react'
import {RunTitle} from './RunTitle'

test('toggles from the run title and exposes its expanded state', () => {
	const onToggle = jest.fn()
	render(<RunTitle expanded={true} title="Calgary analysis" onToggle={onToggle}>
		<span>Calgary</span>
	</RunTitle>)

	const title = screen.getByRole('button', {name: 'Calgary'})
	expect(title).toHaveAttribute('aria-expanded', 'true')
	fireEvent.click(title)
	expect(onToggle).toHaveBeenCalledTimes(1)
})

test.each(['Enter', ' '])('toggles the run title with the %p key', key => {
	const onToggle = jest.fn()
	render(<RunTitle expanded={false} title="Calgary analysis" onToggle={onToggle}>
		<span>Calgary</span>
	</RunTitle>)

	const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true})
	screen.getByRole('button', {name: 'Calgary'}).dispatchEvent(event)
	expect(event.defaultPrevented).toBe(true)
	expect(onToggle).toHaveBeenCalledTimes(1)
})
