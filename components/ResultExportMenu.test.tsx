import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import {ResultExportMenu} from './ResultExportMenu'

Enzyme.configure({adapter: new Adapter()})

test('offers filtered and complete report exports', () => {
	const onExport = jest.fn()
	const wrapper = mount(<ResultExportMenu filteredCount={3} allCount={8} onExport={onExport} />)
	wrapper.find('.swcResultExport > button').simulate('click')
	wrapper.update()

	expect(document.body.textContent).toContain('Export filtered findings (3)')
	expect(document.body.textContent).toContain('Export all findings (8)')
	const buttons = document.querySelectorAll<HTMLButtonElement>('.swcResultExportMenu button')
	buttons[1].click()
	expect(onExport).toHaveBeenCalledWith('all')
	wrapper.unmount()
})
