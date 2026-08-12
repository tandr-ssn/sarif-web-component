import {fireEvent, render, screen} from '@testing-library/react'
import * as React from 'react'
import {observable} from 'mobx'
import {ResultFieldSelector} from './ResultFieldSelector'

test('renders a nested field tree and updates the selection', () => {
	const selected = observable.box(['Path', 'Details', 'Level', 'Kind'])
	render(<ResultFieldSelector
		fieldPaths={['Path', 'Details', 'Level', 'Kind', 'result.properties.acah.sink.selection.status',
			'result.message.text', 'rule.shortDescription.text', 'rule.helpUri']}
		selected={selected} />)
	fireEvent.click(screen.getByRole('button', {name: /Fields:/}))

	expect(document.body.textContent).toContain('Properties')
	expect(document.body.textContent).toContain('ACAH')
	expect(document.body.textContent).toContain('Selection')
	expect(document.body.textContent).toContain('Status')
	expect(document.body.textContent).toContain('Rule')
	expect(document.body.textContent).toContain('Short Description')
	const status = document.querySelector(
		'label[data-swc-tooltip="SARIF JSON path: $.runs[*].results[*].properties.acah.sink.selection.status"] input') as HTMLInputElement
	fireEvent.click(status)
	expect(selected.get()).toContain('result.properties.acah.sink.selection.status')
	expect(document.querySelector(
		'label[data-swc-tooltip="SARIF JSON path: $.runs[*].tool.driver.rules[*].helpUri"] input')).not.toBeNull()
})

test('clears a parent indeterminate mark when its final selected leaf is cleared', () => {
	const selected = observable.box(['Path'])
	render(<ResultFieldSelector
		fieldPaths={['Path', 'result.properties.acah.sink.selection.status', 'result.message.text']}
		selected={selected} />)
	fireEvent.click(screen.getByRole('button', {name: /Fields:/}))
	const status = document.querySelector(
		'label[data-swc-tooltip="SARIF JSON path: $.runs[*].results[*].properties.acah.sink.selection.status"] input') as HTMLInputElement
	const resultLabel = Array.from(document.querySelectorAll<HTMLLabelElement>('.swcResultFieldMenu label'))
		.find(label => label.textContent === 'Result')
	const result = resultLabel.querySelector('input') as HTMLInputElement

	fireEvent.click(status)
	expect(result.indeterminate).toBe(true)

	fireEvent.click(status)
	expect(result.checked).toBe(false)
	expect(result.indeterminate).toBe(false)
})

test('reorders, removes, and restores selected columns', () => {
	const selected = observable.box(['Path', 'Details', 'Level'])
	render(<ResultFieldSelector fieldPaths={['Path', 'Details', 'Level', 'Kind']} selected={selected} />)
	fireEvent.click(screen.getByRole('button', {name: /Fields:/}))

	fireEvent.click(screen.getByRole('button', {name: 'Move Details left'}))
	expect(selected.get()).toEqual(['Details', 'Path', 'Level'])
	fireEvent.click(screen.getByRole('button', {name: 'Remove Level'}))
	expect(selected.get()).toEqual(['Details', 'Path'])
	fireEvent.click(screen.getByRole('button', {name: 'Restore defaults'}))
	expect(selected.get()).toEqual(['Path', 'Details', 'Level', 'Kind'])
})
