import * as React from 'react'
import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {FindingVisibilityFilter, getFindingVisibility} from './FindingVisibilityFilter'
import {MobxFilter} from './FilterBar'

Enzyme.configure({adapter: new Adapter()})

test('selects visible, hidden, or all findings through the shared filter', () => {
	const filter = new MobxFilter()
	const wrapper = mount(<FindingVisibilityFilter filter={filter} />)
	expect(getFindingVisibility(filter)).toBe('visible')

	wrapper.find('select').simulate('change', {target: {value: 'hidden'}})
	expect(getFindingVisibility(filter)).toBe('hidden')
	wrapper.find('select').simulate('change', {target: {value: 'all'}})
	expect(getFindingVisibility(filter)).toBe('all')

	wrapper.unmount()
})
