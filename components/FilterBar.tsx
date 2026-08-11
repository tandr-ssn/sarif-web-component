// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './FilterBar.scss'
import { createAtom, observable } from 'mobx'
import { observer } from 'mobx-react'
import * as React from 'react'

import { Callout } from 'azure-devops-ui/Callout'
import { FilterBar as AzFilterBar } from 'azure-devops-ui/FilterBar'
import { KeywordFilterBarItem } from 'azure-devops-ui/TextFilterBarItem'
import { Filter, FILTER_CHANGE_EVENT, IFilterState } from 'azure-devops-ui/Utilities/Filter'
import { Location } from 'azure-devops-ui/Utilities/Position'

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

export function clearFilterItem(filter: MobxFilter, key: string) {
	// Keep an object for Keywords because RunStore iterates non-column filter states.
	if (key === 'Keywords') filter.setFilterItemState(key, {value: ''})
	else filter.resetFilterItemState(key)
}

@observer export class ClearAllFiltersButton extends React.Component<{filter: MobxFilter}> {
	@observable private open = false
	private anchor?: HTMLButtonElement

	render() {
		const {filter} = this.props
		const active = getActiveFilterDescriptions(filter)
		if (!active.some(item => item.key !== 'Keywords')) return null
		const tooltip = `Clear all filters\n${active.map(item => item.description).join('\n')}`
		return <div className="swcClearFilters">
			<button type="button" className="swcClearAllFilters"
				ref={element => this.anchor = element ?? undefined}
				aria-label={`Clear filters; ${active.length} active`}
				aria-expanded={this.open} aria-haspopup="menu"
				data-swc-tooltip={tooltip}
				onClick={() => this.open = !this.open}>Clear filters ({active.length}) <span aria-hidden="true">{this.open ? '▴' : '▾'}</span></button>
			{this.open && this.anchor && <Callout anchorElement={this.anchor}
				anchorOrigin={{horizontal: Location.start, vertical: Location.end}}
				calloutOrigin={{horizontal: Location.start, vertical: Location.start}}
				blurDismiss={false} escDismiss={true} lightDismiss={true}
				onDismiss={() => this.open = false}>
				<div className="swcClearFiltersMenu" role="menu">
					{active.map(item => <button type="button" role="menuitem" key={item.key}
						aria-label={`Clear filter: ${item.description}`}
						onClick={() => { clearFilterItem(filter, item.key); this.open = false }}><span aria-hidden="true">×</span>{item.description}</button>)}
					<hr role="separator" />
					<button type="button" role="menuitem" className="swcClearFiltersAll"
						onClick={() => { filter.reset(); this.open = false }}>Clear all filters</button>
				</div>
			</Callout>}
		</div>
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
