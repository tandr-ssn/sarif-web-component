import * as React from 'react'
import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {FindingVisibilityFilter, getFindingVisibility} from './FindingVisibilityFilter'
import {MobxFilter} from './FilterBar'
import {DropdownFilterBarItem} from './AzureDevOpsUi'

Enzyme.configure({adapter: new Adapter()})

test('selects visible, hidden, or all findings through the shared filter', () => {
	const filter = new MobxFilter()
	const wrapper = mount(<FindingVisibilityFilter filter={filter} />)
	expect(getFindingVisibility(filter)).toBe('visible')
	const dropdown = wrapper.find(DropdownFilterBarItem)
	expect(dropdown.prop('placeholder')).toBe('Visibility')
	expect((dropdown.prop('items') as any[]).map(item => item.text)).toEqual(['Visible', 'Hidden'])

	filter.setFilterItemState('Triage', {value: ['hidden']})
	expect(getFindingVisibility(filter)).toBe('hidden')
	filter.setFilterItemState('Triage', {value: ['visible', 'hidden']})
	expect(getFindingVisibility(filter)).toBe('all')
	filter.setFilterItemState('Triage', {value: []})
	expect(getFindingVisibility(filter)).toBe('none')
	wrapper.update()
	expect(wrapper.find(DropdownFilterBarItem).prop('placeholder')).toBe('Visibility: none')

	wrapper.unmount()
})
