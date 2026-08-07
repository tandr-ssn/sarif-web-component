import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import {ResultExportMenu} from './ResultExportMenu'

Enzyme.configure({adapter: new Adapter()})

test('exports the filtered report directly when filters are active', () => {
	const onExport = jest.fn()
	const wrapper = mount(<ResultExportMenu filteredCount={3} allCount={8} filtered={true} onExport={onExport} />)
	const button = wrapper.find('.swcResultExport > button')
	expect(button.text()).toBe('Export filtered')
	button.simulate('click')
	expect(onExport).toHaveBeenCalledWith('filtered')
	wrapper.unmount()
})

test('exports the complete report directly when no filters are active', () => {
	const onExport = jest.fn()
	const wrapper = mount(<ResultExportMenu filteredCount={8} allCount={8} filtered={false} onExport={onExport} />)
	const button = wrapper.find('.swcResultExport > button')
	expect(button.text()).toBe('Export all')
	button.simulate('click')
	expect(onExport).toHaveBeenCalledWith('all')
	wrapper.unmount()
})
