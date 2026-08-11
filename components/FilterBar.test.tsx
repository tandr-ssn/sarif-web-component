import * as React from 'react'
import {shallow} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {FilterBar as AzFilterBar} from 'azure-devops-ui/FilterBar'
import {KeywordFilterBarItem} from 'azure-devops-ui/TextFilterBarItem'
import {ClearFilterBarItem, FilterBar, MobxFilter} from './FilterBar'

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
	expect(wrapper.find('.swcFilterToolbarActions').children().map(child => child.prop('id')))
		.toEqual(['fields', 'export', 'view-options'])
})

test('clears active filters from the explicit trailing X', () => {
	const filter = new MobxFilter({}, {})
	filter.setFilterItemState('Keywords', {value: 'Calgary'})
	const wrapper = shallow(<ClearFilterBarItem filter={filter} />)

	expect(wrapper.find('button').prop('disabled')).toBe(false)
	wrapper.find('button').simulate('click')
	expect(filter.getFilterItemValue('Keywords')).toBeUndefined()
})
