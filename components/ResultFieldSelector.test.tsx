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
	wrapper.find('.swcResultFieldSelector > button').simulate('click')
	wrapper.update()

	expect(document.body.textContent).toContain('properties')
	expect(document.body.textContent).toContain('audit')
	expect(document.body.textContent).toContain('selection')
	expect(document.body.textContent).toContain('status')
	const status = document.querySelector('label[title="properties.audit.selection.status"] input') as HTMLInputElement
	status.click()
	expect(selected.get()).toContain('properties.audit.selection.status')
	wrapper.unmount()
})
