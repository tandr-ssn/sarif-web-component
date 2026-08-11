import * as React from 'react'
import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {observable} from 'mobx'
import {MoreButton} from 'azure-devops-ui/Menu'
import {SortOrder} from 'azure-devops-ui/Table'
import {SortRuleBy} from './RunStore'
import {ResultViewOptionsMenu} from './ResultViewOptionsMenu'

Enzyme.configure({adapter: new Adapter()})

function menuItems(wrapper) {
	const props = wrapper.find(MoreButton).prop('contextualMenuProps') as Function
	return props().menuProps.items
}

test('moves shared grouping and rule sorting choices into the result toolbar menu', () => {
	const groupByAge = observable.box(false)
	const stores = [
		{showAge: true, groupByAge, sortRuleBy: SortRuleBy.Count, sortRuleOrder: SortOrder.descending},
		{showAge: true, groupByAge, sortRuleBy: SortRuleBy.Count, sortRuleOrder: SortOrder.descending},
	] as any
	const wrapper = mount(<ResultViewOptionsMenu runStores={stores} />)
	let items = menuItems(wrapper)

	expect(items.map(item => item.id)).toEqual([
		'groupByAge', 'groupByRule', 'groupDivider', 'sortByRuleCount', 'sortByRuleName',
	])
	expect(items.find(item => item.id === 'groupByRule').checked).toBe(true)
	items.find(item => item.id === 'groupByAge').onActivate()
	expect(groupByAge.get()).toBe(true)

	items.find(item => item.id === 'sortByRuleName').onActivate()
	wrapper.setProps({runStores: stores.slice()})
	expect(stores.map(store => store.sortRuleBy)).toEqual([SortRuleBy.Name, SortRuleBy.Name])
	expect(stores.map(store => store.sortRuleOrder)).toEqual([SortOrder.ascending, SortOrder.ascending])
	items = menuItems(wrapper)
	expect(items.find(item => item.id === 'sortByRuleName').checked).toBe(true)

	wrapper.unmount()
})

test('omits grouping choices when age grouping is unavailable', () => {
	const stores = [{showAge: false, groupByAge: observable.box(false), sortRuleBy: SortRuleBy.Count}] as any
	const wrapper = mount(<ResultViewOptionsMenu runStores={stores} />)

	expect(menuItems(wrapper).map(item => item.id)).toEqual(['sortByRuleCount', 'sortByRuleName'])
	wrapper.unmount()
})
