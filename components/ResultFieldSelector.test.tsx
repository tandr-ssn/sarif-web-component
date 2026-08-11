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
		fieldPaths={['Path', 'Details', 'Level', 'Kind', 'result.properties.acah.sink.selection.status',
			'result.message.text', 'rule.shortDescription.text', 'rule.helpUri']}
		selected={selected} />)
	wrapper.find('.swcResultFieldSelector > button').simulate('click')
	wrapper.update()

	expect(document.body.textContent).toContain('Properties')
	expect(document.body.textContent).toContain('ACAH')
	expect(document.body.textContent).toContain('Selection')
	expect(document.body.textContent).toContain('Status')
	expect(document.body.textContent).toContain('Rule')
	expect(document.body.textContent).toContain('Short Description')
	const status = document.querySelector(
		'label[data-swc-tooltip="SARIF JSON path: $.runs[*].results[*].properties.acah.sink.selection.status"] input') as HTMLInputElement
	status.click()
	expect(selected.get()).toContain('result.properties.acah.sink.selection.status')
	expect(document.querySelector(
		'label[data-swc-tooltip="SARIF JSON path: $.runs[*].tool.driver.rules[*].helpUri"] input')).not.toBeNull()
	wrapper.unmount()
})
