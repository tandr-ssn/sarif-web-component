import * as React from 'react'
import {shallow} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {FilterBar as AzFilterBar} from 'azure-devops-ui/FilterBar'
import {KeywordFilterBarItem} from 'azure-devops-ui/TextFilterBarItem'
import {FilterBar, MobxFilter} from './FilterBar'

Enzyme.configure({adapter: new Adapter()})

test('uses the integrated keyword clear control and renders result actions beside the search', () => {
	const filter = new MobxFilter({}, {})
	const wrapper = shallow(<FilterBar filter={filter} groupByAge={false}
		findingVisibilityFilter={<span id="visibility" />}
		resultFieldSelector={<span id="fields" />}
		resultExportMenu={<span id="export" />}
		resultViewOptionsMenu={<span id="view-options" />} />)
	const keywordFilter = wrapper.find(AzFilterBar)

	expect(keywordFilter.prop('hideClearAction')).toBe(false)
	expect(keywordFilter.find(KeywordFilterBarItem)).toHaveLength(1)
	expect(keywordFilter.find(KeywordFilterBarItem).prop('clearable')).toBe(true)
	const actions = wrapper.find('.swcFilterToolbarActions').children()
	expect(actions.map(child => child.prop('id'))).toEqual(['visibility', 'fields', 'export', 'view-options'])
})

test('adds the implicit visible finding state to host-provided starting filters', () => {
	const filter = new MobxFilter(undefined, {
		Baseline: {value: ['new', 'unchanged', 'updated']},
		Suppression: {value: ['unsuppressed']},
	})

	expect(filter.getFilterItemValue('Triage')).toEqual(['visible'])
	expect(filter.hasChangesToReset()).toBe(false)
})
