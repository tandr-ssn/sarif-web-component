// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

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

@observer export class FilterBar extends React.Component<{ filter: MobxFilter, readonly groupByAge: boolean, hideBaseline?: boolean, hideLevel?: boolean, showSuppression?: boolean, showAge?: boolean, resultFieldSelector?: React.ReactNode, resultExportMenu?: React.ReactNode }> {
	render() {
		const {filter, resultFieldSelector, resultExportMenu} = this.props
		return <AzFilterBar filter={filter}>
			<KeywordFilterBarItem filterItemKey="Keywords" placeholder="Filter by keyword" />
			{resultFieldSelector}
			{resultExportMenu}
		</AzFilterBar>
	}
}
