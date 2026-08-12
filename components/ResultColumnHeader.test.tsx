import {render} from '@testing-library/react'
import * as React from 'react'
import {ResultColumnHeader, resultColumnFilterOptions} from './ResultColumnHeader'
import {RunStore} from './RunStore'

test('shows the full SARIF JSON path in a selected field column tooltip', () => {
	const runStore = {
		filter: {getFilterItemValue: () => undefined},
		columnFilterOptions: () => [],
	} as unknown as RunStore
	const {container} = render(<ResultColumnHeader columnIndex={0}
		column={{id: 'rule.helpUri', name: 'Help URI'} as any} runStores={[runStore]} />)

	expect(container.querySelector<HTMLElement>('.swcColumnTitle')?.dataset.swcTooltip)
		.toBe('SARIF JSON path: $.runs[*].tool.driver.rules[*].helpUri')
})

test('marks a column title when its filter is active', () => {
	const runStore = {
		filter: {getFilterItemValue: () => 'blocked'},
		columnFilterOptions: () => [],
	} as unknown as RunStore
	const {container} = render(<ResultColumnHeader columnIndex={0}
		column={{id: 'Details', name: 'Details'} as any} runStores={[runStore]} />)

	const active = container.querySelector<HTMLElement>('.swcColumnFilterActive')
	expect(active).not.toBeNull()
	expect(active?.textContent).toBe('FILTER')
	expect(active?.dataset.swcTooltip)
		.toBe('Active filter: contains “blocked”')
})

test('aggregates dropdown filter choices across all runs', () => {
	const stores = [
		{columnFilterOptions: () => ['pass', 'fail']},
		{columnFilterOptions: () => ['review', 'pass']},
	] as unknown as RunStore[]

	expect(resultColumnFilterOptions(stores, 'Kind')).toEqual(['fail', 'pass', 'review'])
})
