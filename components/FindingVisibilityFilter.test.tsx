import * as React from 'react'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {FindingVisibilityFilter, getFindingVisibility} from './FindingVisibilityFilter'
import {MobxFilter} from './FilterBar'

test('selects visible, hidden, or all findings through the shared filter', () => {
	const filter = new MobxFilter()
	render(<FindingVisibilityFilter filter={filter} visibleCount={7} hiddenCount={2} />)
	expect(getFindingVisibility(filter)).toBe('visible')
	const dropdown = screen.getByRole('button', {name: 'Finding visibility'})
	expect(dropdown).toHaveTextContent('Visibility: Visible')
	fireEvent.click(dropdown)
	expect(document.body).toHaveTextContent('Visible (7)')
	expect(document.body).toHaveTextContent('Hidden (2)')

	act(() => filter.setFilterItemState('Triage', {value: ['hidden']}))
	expect(getFindingVisibility(filter)).toBe('hidden')
	act(() => filter.setFilterItemState('Triage', {value: ['visible', 'hidden']}))
	expect(getFindingVisibility(filter)).toBe('all')
	expect(dropdown).toHaveTextContent('Visibility: All')
	act(() => filter.setFilterItemState('Triage', {value: []}))
	expect(getFindingVisibility(filter)).toBe('none')
	expect(screen.getByText('Visibility: none')).toBeVisible()
})
