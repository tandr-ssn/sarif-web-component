import * as React from 'react'
import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {FindingVisibilityFilter, getFindingVisibility} from './FindingVisibilityFilter'
import {MobxFilter} from './FilterBar'

Enzyme.configure({adapter: new Adapter()})

test('selects visible, hidden, or all findings through the shared filter', () => {
	const filter = new MobxFilter()
	const wrapper = mount(<FindingVisibilityFilter filter={filter} visibleCount={7} hiddenCount={2} />)
	expect(getFindingVisibility(filter)).toBe('visible')
	expect(wrapper.find('option').map(option => option.text())).toEqual(['Visible (7)', 'Hidden (2)', 'All (9)'])

	wrapper.find('select').simulate('change', {target: {value: 'hidden'}})
	expect(getFindingVisibility(filter)).toBe('hidden')
	wrapper.find('select').simulate('change', {target: {value: 'all'}})
	expect(getFindingVisibility(filter)).toBe('all')

	wrapper.unmount()
})
