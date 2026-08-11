import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import {ResultExportMenu} from './ResultExportMenu'

Enzyme.configure({adapter: new Adapter()})

test('exports filtered findings as plain-text CSV', () => {
	const onExport = jest.fn()
	const wrapper = mount(<ResultExportMenu filteredCount={3} allCount={8} filtered={true} onExport={onExport} />)
	const button = wrapper.find('.swcResultExport > button')
	expect(button.text()).toContain('Export filtered')
	button.simulate('click')
	wrapper.update()
	const csv = document.querySelector('.swcResultExportMenu button') as HTMLButtonElement
	csv.click()
	expect(onExport).toHaveBeenCalledWith('filtered', 'csv-plain')
	wrapper.unmount()
})

test('offers a Markdown report for the complete result set', () => {
	const onExport = jest.fn()
	const wrapper = mount(<ResultExportMenu filteredCount={8} allCount={8} filtered={false} onExport={onExport} />)
	const button = wrapper.find('.swcResultExport > button')
	expect(button.text()).toContain('Export all')
	button.simulate('click')
	wrapper.update()
	const markdown = Array.from(document.querySelectorAll<HTMLButtonElement>('.swcResultExportMenu button'))
		.find(candidate => candidate.textContent === 'Markdown')
	markdown.click()
	expect(onExport).toHaveBeenCalledWith('all', 'markdown')
	wrapper.unmount()
})
