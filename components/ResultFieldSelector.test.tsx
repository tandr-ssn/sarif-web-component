import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import {observable} from 'mobx'
import {ResultFieldSelector} from './ResultFieldSelector'

Enzyme.configure({adapter: new Adapter()})

test('renders a nested field tree and updates the selection', () => {
	const selected = observable.box(['Path', 'Details', 'Level', 'Kind'])
	const wrapper = mount(<ResultFieldSelector
		fieldPaths={['Path', 'Details', 'Level', 'Kind', 'properties.acah.sink.selection.status']}
		selected={selected} />)
	wrapper.find('.swcResultFieldSelector > button').simulate('click')
	wrapper.update()

	expect(document.body.textContent).toContain('Properties')
	expect(document.body.textContent).toContain('ACAH')
	expect(document.body.textContent).toContain('Selection')
	expect(document.body.textContent).toContain('Status')
	const status = document.querySelector('label[title="properties.acah.sink.selection.status"] input') as HTMLInputElement
	status.click()
	expect(selected.get()).toContain('properties.acah.sink.selection.status')
	wrapper.unmount()
})
