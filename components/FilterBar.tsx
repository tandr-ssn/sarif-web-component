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

@observer export class ClearFilterBarItem extends React.Component<{filter?: MobxFilter}> {
	private button?: HTMLButtonElement

	focus() {
		this.button?.focus()
	}

	render() {
		const {filter} = this.props
		filter?.getState() // Subscribe this MobX observer to filter changes.
		const disabled = !filter?.hasChangesToReset()
		return <button type="button" className="swcFilterClear" aria-label="Clear filters"
			data-swc-tooltip="Clear filters" disabled={disabled}
			ref={element => this.button = element ?? undefined}
			onClick={() => filter?.reset()}><span aria-hidden="true">×</span></button>
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
				<KeywordFilterBarItem filterItemKey="Keywords" placeholder="Filter by keyword" />
				<ClearFilterBarItem />
			</AzFilterBar>
			<div className="swcFilterToolbarActions">
				{resultFieldSelector}
				{resultExportMenu}
				{resultViewOptionsMenu}
			</div>
		</div>
	}
}
