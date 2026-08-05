import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import * as Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import {observable} from 'mobx'
import {ResultFieldSelector} from './ResultFieldSelector'

Enzyme.configure({adapter: new Adapter()})

test('renders a nested field tree and updates the selection', () => {
	const selected = observable.box(['Path', 'Details', 'Level', 'Kind'])
	const wrapper = mount(<ResultFieldSelector
		fieldPaths={['Path', 'Details', 'Level', 'Kind', 'properties.audit.selection.status']}
		selected={selected} />)

	expect(wrapper.text()).toContain('properties')
	expect(wrapper.text()).toContain('audit')
	expect(wrapper.text()).toContain('selection')
	expect(wrapper.text()).toContain('status')
	const status = wrapper.find('label[title="properties.audit.selection.status"] input')
	;(status.getDOMNode() as HTMLInputElement).checked = true
	status.simulate('change')
	expect(selected.get()).toContain('properties.audit.selection.status')
	wrapper.unmount()
})
