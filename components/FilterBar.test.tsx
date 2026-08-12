import * as React from 'react'
import {render, screen} from '@testing-library/react'
import {FilterBar, MobxFilter} from './FilterBar'

test('uses the integrated keyword clear control and renders result actions beside the search', () => {
	const filter = new MobxFilter({}, {})
	const {container} = render(<FilterBar filter={filter} groupByAge={false}
		findingVisibilityFilter={<span id="visibility" />}
		resultFieldSelector={<span id="fields" />}
		resultExportMenu={<span id="export" />}
		resultViewOptionsMenu={<span id="view-options" />} />)
	expect(screen.getByPlaceholderText('Filter by keyword')).toBeVisible()
	expect(container.querySelector('.swcKeywordFilter')).not.toBeNull()
	const actions = container.querySelector('.swcFilterToolbarActions')
	expect(Array.from(actions?.children ?? []).map(child => child.id)).toEqual(['visibility', 'fields', 'export', 'view-options'])
})

test('adds the implicit visible finding state to host-provided starting filters', () => {
	const filter = new MobxFilter(undefined, {
		Baseline: {value: ['new', 'unchanged', 'updated']},
		Suppression: {value: ['unsuppressed']},
	})

	expect(filter.getFilterItemValue('Triage')).toEqual(['visible'])
	expect(filter.hasChangesToReset()).toBe(false)
})
