import {fireEvent, render, screen} from '@testing-library/react'
import * as React from 'react'
import {ResultExportMenu} from './ResultExportMenu'

test('exports filtered findings as plain-text CSV', () => {
	const onExport = jest.fn()
	render(<ResultExportMenu filteredCount={3} allCount={8} filtered={true} onExport={onExport} />)
	const button = screen.getByRole('button', {name: /Export: filtered/})
	fireEvent.click(button)
	const choices = Array.from(document.querySelectorAll<HTMLButtonElement>('.swcResultExportMenu button'))
	expect(choices.map(choice => choice.textContent)).toEqual([
		'CSV — plain text', 'CSV — raw values', 'TSV', 'HTML — report', 'HTML — table', 'Plain text', 'Markdown',
	])
	const csv = choices[0]
	fireEvent.click(csv)
	expect(onExport).toHaveBeenCalledWith('filtered', 'csv-plain')
})

test('offers a logical-column HTML table', () => {
	const onExport = jest.fn()
	render(<ResultExportMenu filteredCount={3} allCount={8} filtered={true} onExport={onExport} />)
	fireEvent.click(screen.getByRole('button', {name: /Export: filtered/}))
	const htmlTable = Array.from(document.querySelectorAll<HTMLButtonElement>('.swcResultExportMenu button'))
		.find(candidate => candidate.textContent === 'HTML — table')
	fireEvent.click(htmlTable)
	expect(onExport).toHaveBeenCalledWith('filtered', 'html-table')
})

test('offers a Markdown report for all visible findings', () => {
	const onExport = jest.fn()
	render(<ResultExportMenu filteredCount={8} allCount={8} filtered={false} onExport={onExport} />)
	fireEvent.click(screen.getByRole('button', {name: /Export: visible/}))
	const markdown = Array.from(document.querySelectorAll<HTMLButtonElement>('.swcResultExportMenu button'))
		.find(candidate => candidate.textContent === 'Markdown')
	fireEvent.click(markdown)
	expect(onExport).toHaveBeenCalledWith('all', 'markdown')
})
