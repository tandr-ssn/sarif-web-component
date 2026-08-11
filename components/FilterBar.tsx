// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './FilterBar.scss'
import { createAtom } from 'mobx'
import { observer } from 'mobx-react'
import * as React from 'react'

import { FilterBar as AzFilterBar } from 'azure-devops-ui/FilterBar'
import { KeywordFilterBarItem } from 'azure-devops-ui/TextFilterBarItem'
import { Filter, FILTER_CHANGE_EVENT, IFilterState } from 'azure-devops-ui/Utilities/Filter'

export const recommendedDefaultState = {
	Baseline: { value: ['new', 'unchanged', 'updated'] },
	Suppression: { value: ['unsuppressed'] },
}

export class MobxFilter extends Filter {
	private atom = createAtom('MobxFilter')
	constructor(defaultState?: IFilterState, startingState?: IFilterState) {
		super()
		this.setDefaultState(defaultState || recommendedDefaultState)
		this.setState(startingState || defaultState || recommendedDefaultState, true)
		this.subscribe(() => {
			this.atom.reportChanged()
		}, FILTER_CHANGE_EVENT)
	}
	getState() {
		this.atom.reportObserved()
		return super.getState()
	}
	getFilterItemValue<T>(key: string): T | undefined {
		this.atom.reportObserved()
		return super.getFilterItemValue<T>(key)
	}
}

export interface ActiveFilterDescription {
	key: string
	description: string
}

function filterValueText(value: unknown): string {
	if (Array.isArray(value)) return value.join(', ')
	if (value && typeof value === 'object') return JSON.stringify(value)
	return String(value ?? '')
}

export function getActiveFilterDescriptions(filter: MobxFilter): ActiveFilterDescription[] {
	const state = filter.getState()
	const defaults = filter.getDefaultState()
	return Array.from(new Set([...Object.keys(defaults), ...Object.keys(state)]))
		.filter(key => !filter.filterItemStatesAreEqual(key, state[key] ?? null, defaults[key] ?? null))
		.map(key => {
			const value = state[key]?.value
			if (key === 'Keywords') return {key, description: `Keyword: “${filterValueText(value)}”`}
			if (key.startsWith('Column:')) {
				const field = key.slice('Column:'.length)
				return {key, description: typeof value === 'string'
					? `${field}: contains “${value}”`
					: `${field}: ${filterValueText(value)}`}
			}
			return {key, description: `${key}: ${filterValueText(value)}`}
		})
}

@observer export class ClearAllFiltersButton extends React.Component<{filter: MobxFilter}> {
	render() {
		const {filter} = this.props
		const active = getActiveFilterDescriptions(filter)
		if (!active.some(item => item.key !== 'Keywords')) return null
		const tooltip = `Clear all filters\n${active.map(item => item.description).join('\n')}`
		return <button type="button" className="swcClearAllFilters"
			aria-label={`Clear all filters; ${active.length} active`}
			data-swc-tooltip={tooltip}
			onClick={() => filter.reset()}>Clear filters ({active.length})</button>
	}
}

@observer export class FilterBar extends React.Component<{
	filter: MobxFilter
	readonly groupByAge: boolean
	hideBaseline?: boolean
	hideLevel?: boolean
	showSuppression?: boolean
	showAge?: boolean
	resultFieldSelector?: React.ReactNode
	resultExportMenu?: React.ReactNode
	resultViewOptionsMenu?: React.ReactNode
}> {
	render() {
		const {filter, resultFieldSelector, resultExportMenu, resultViewOptionsMenu} = this.props
		return <div className="swcFilterToolbar">
			<AzFilterBar className="swcKeywordFilter" filter={filter} hideClearAction={true}>
				<KeywordFilterBarItem filterItemKey="Keywords" placeholder="Filter by keyword" clearable />
			</AzFilterBar>
			<div className="swcFilterToolbarActions">
				<ClearAllFiltersButton filter={filter} />
				{resultFieldSelector}
				{resultExportMenu}
				{resultViewOptionsMenu}
			</div>
		</div>
	}
}
