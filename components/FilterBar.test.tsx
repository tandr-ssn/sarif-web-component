import * as React from 'react'
import {shallow} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {FilterBar as AzFilterBar} from 'azure-devops-ui/FilterBar'
import {KeywordFilterBarItem} from 'azure-devops-ui/TextFilterBarItem'
import {ClearAllFiltersButton, ClearFilterBarItem, FilterBar, MobxFilter} from './FilterBar'

Enzyme.configure({adapter: new Adapter()})

test('ends the raised keyword filter at Clear and renders result actions beside it', () => {
	const filter = new MobxFilter({}, {})
	const wrapper = shallow(<FilterBar filter={filter} groupByAge={false}
		resultFieldSelector={<span id="fields" />}
		resultExportMenu={<span id="export" />}
		resultViewOptionsMenu={<span id="view-options" />} />)
	const keywordFilter = wrapper.find(AzFilterBar)

	expect(keywordFilter.prop('hideClearAction')).toBe(true)
	expect(keywordFilter.find(KeywordFilterBarItem)).toHaveLength(1)
	expect(keywordFilter.find(ClearFilterBarItem)).toHaveLength(1)
	const actions = wrapper.find('.swcFilterToolbarActions').children()
	expect(actions.at(0).is(ClearAllFiltersButton)).toBe(true)
	expect(actions.slice(1).map(child => child.prop('id'))).toEqual(['fields', 'export', 'view-options'])
})

test('clears only the keyword filter from the trailing search X', () => {
	const filter = new MobxFilter({}, {})
	filter.setFilterItemState('Keywords', {value: 'Calgary'})
	filter.setFilterItemState('Column:Details', {value: 'blocked'})
	const wrapper = shallow(<ClearFilterBarItem filter={filter} />)

	expect(wrapper.find('button').prop('disabled')).toBe(false)
	wrapper.find('button').simulate('click')
	expect(filter.getFilterItemValue('Keywords')).toBe('')
	expect(filter.getFilterItemValue('Column:Details')).toBe('blocked')
})

test('shows and clears all active filters when a non-keyword filter is active', () => {
	const filter = new MobxFilter({}, {})
	filter.setFilterItemState('Keywords', {value: 'Calgary'})
	filter.setFilterItemState('Column:Details', {value: 'blocked'})
	const wrapper = shallow(<ClearAllFiltersButton filter={filter} />)

	expect(wrapper.find('button').text()).toBe('Clear filters (2)')
	expect(wrapper.find('button').prop('data-swc-tooltip'))
		.toBe('Clear all filters\nKeyword: “Calgary”\nDetails: contains “blocked”')
	wrapper.find('button').simulate('click')
	expect(filter.hasChangesToReset()).toBe(false)
})
