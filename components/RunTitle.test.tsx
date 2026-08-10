import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import {TreeExpand} from 'azure-devops-ui/TreeEx'
import {RunTitle} from './RunTitle'

Enzyme.configure({adapter: new Adapter()})

test('toggles from the run title and exposes its expanded state', () => {
	const onToggle = jest.fn()
	const wrapper = mount(<RunTitle expanded={true} title="Calgary analysis" onToggle={onToggle}>
		<span>Calgary</span>
	</RunTitle>)

	expect(wrapper.find('.swcRunTitleToggle').prop('aria-expanded')).toBe(true)
	expect(wrapper.find(TreeExpand).prop('expanded')).toBe(true)
	wrapper.find('.swcRunTitleToggle').simulate('click')
	expect(onToggle).toHaveBeenCalledTimes(1)
})

test.each(['Enter', ' '])('toggles the run title with the %p key', key => {
	const onToggle = jest.fn()
	const preventDefault = jest.fn()
	const wrapper = mount(<RunTitle expanded={false} title="Calgary analysis" onToggle={onToggle}>
		<span>Calgary</span>
	</RunTitle>)

	wrapper.find('.swcRunTitleToggle').simulate('keydown', {key, preventDefault})
	expect(preventDefault).toHaveBeenCalled()
	expect(onToggle).toHaveBeenCalledTimes(1)
})
