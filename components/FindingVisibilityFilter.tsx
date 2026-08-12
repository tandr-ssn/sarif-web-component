import * as React from 'react'
import {observer} from 'mobx-react'
import {MobxFilter} from './FilterBar'
import {DropdownFilterBarItem, DropdownMultiSelection} from './AzureDevOpsUi'

export type FindingVisibility = 'visible' | 'hidden' | 'all' | 'none'

export function getFindingVisibility(filter: MobxFilter): FindingVisibility {
	const values = filter.getState().Triage?.value as string[] | undefined
	if (values?.includes('visible') && values.includes('hidden')) return 'all'
	if (values?.includes('hidden')) return 'hidden'
	if (values?.includes('visible')) return 'visible'
	return 'none'
}

@observer export class FindingVisibilityFilter extends React.Component<{
	filter: MobxFilter
	showPlaceholderAsLabel?: boolean
}> {
	private selection = new DropdownMultiSelection()
	private item?: {focus(): void}
	private dropdownGeneration = 0
	focus() { this.item?.focus() }
	private collapseAfterClear = () => {
		this.dropdownGeneration++
		this.forceUpdate()
	}

	render() {
		const visibility = getFindingVisibility(this.props.filter)
		return <DropdownFilterBarItem key={this.dropdownGeneration} className="swcFindingVisibility"
			componentRef={item => this.item = item as any}
			filter={this.props.filter} filterItemKey="Triage"
			items={[{id: 'visible', text: 'Visible'}, {id: 'hidden', text: 'Hidden'}]}
			selection={this.selection} placeholder={visibility === 'none' ? 'Visibility: none' : 'Visibility'}
			toggleFilterBar={this.collapseAfterClear}
			showPlaceholderAsLabel={this.props.showPlaceholderAsLabel ?? true}
			ariaLabel="Finding visibility" />
	}
}
