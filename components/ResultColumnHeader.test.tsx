import {shallow} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import {ResultColumnHeader} from './ResultColumnHeader'
import {RunStore} from './RunStore'

Enzyme.configure({adapter: new Adapter()})

test('shows the full SARIF JSON path in a selected field column tooltip', () => {
	const runStore = {
		filter: {getFilterItemValue: () => undefined},
		columnFilterOptions: () => [],
	} as unknown as RunStore
	const wrapper = shallow(<ResultColumnHeader columnIndex={0}
		column={{id: 'rule.helpUri', name: 'Help URI'} as any} runStore={runStore} />)

	expect(wrapper.find('.swcColumnTitle').prop('data-swc-tooltip'))
		.toBe('SARIF JSON path: $.runs[*].tool.driver.rules[*].helpUri')
})

test('marks a column title when its filter is active', () => {
	const runStore = {
		filter: {getFilterItemValue: () => 'blocked'},
		columnFilterOptions: () => [],
	} as unknown as RunStore
	const wrapper = shallow(<ResultColumnHeader columnIndex={0}
		column={{id: 'Details', name: 'Details'} as any} runStore={runStore} />)

	expect(wrapper.find('.swcColumnFilterActive')).toHaveLength(1)
	expect(wrapper.find('.swcColumnFilterActive').text()).toBe('FILTER')
	expect(wrapper.find('.swcColumnFilterActive').prop('data-swc-tooltip'))
		.toBe('Active filter: contains “blocked”')
})
