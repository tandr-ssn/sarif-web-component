// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './FilterBar.scss'
import { createAtom } from 'mobx'
import { observer } from 'mobx-react'
import * as React from 'react'

import {FilterBar as AzFilterBar, KeywordFilterBarItem, Filter, FILTER_CHANGE_EVENT, IFilterState} from './AzureDevOpsUi'

export const recommendedDefaultState = {
	Baseline: { value: ['new', 'unchanged', 'updated'] },
	Suppression: { value: ['unsuppressed'] },
	Triage: { value: ['visible'] },
}

export class MobxFilter extends Filter {
	private atom = createAtom('MobxFilter')
	constructor(defaultState?: IFilterState, startingState?: IFilterState) {
		super()
		const effectiveDefault = {
			...(defaultState || recommendedDefaultState),
			Triage: defaultState?.Triage ?? recommendedDefaultState.Triage,
		}
		const effectiveStarting = {
			...(startingState || effectiveDefault),
			Triage: startingState?.Triage ?? effectiveDefault.Triage,
		}
		this.setDefaultState(effectiveDefault)
		this.setState(effectiveStarting, true)
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

@observer export class FilterBar extends React.Component<{
	filter: MobxFilter
	readonly groupByAge: boolean
	hideBaseline?: boolean
	hideLevel?: boolean
	showSuppression?: boolean
	showAge?: boolean
	resultFieldSelector?: React.ReactNode
	findingVisibilityFilter?: React.ReactNode
	resultExportMenu?: React.ReactNode
	resultViewOptionsMenu?: React.ReactNode
}> {
	render() {
		const {filter, resultFieldSelector, findingVisibilityFilter, resultExportMenu, resultViewOptionsMenu} = this.props
		return <div className="swcFilterToolbar">
			<AzFilterBar className="swcKeywordFilter" filter={filter} hideClearAction={false}>
				<KeywordFilterBarItem filterItemKey="Keywords" placeholder="Filter by keyword" clearable />
			</AzFilterBar>
			<div className="swcFilterToolbarActions">
				{findingVisibilityFilter}
				{resultFieldSelector}
				{resultExportMenu}
				{resultViewOptionsMenu}
			</div>
		</div>
	}
}
