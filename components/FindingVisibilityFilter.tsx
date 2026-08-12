import * as React from 'react'
import {observer} from 'mobx-react'
import {MobxFilter} from './FilterBar'
import {DropdownExpandableButton, DropdownFilterBarItem, DropdownMultiSelection, IDropdownExpandableProps} from './AzureDevOpsUi'

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
	visibleCount: number
	hiddenCount: number
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
	private renderSelectedItems = () => {
		const visibility = getFindingVisibility(this.props.filter)
		const text = visibility === 'all' ? 'All' : visibility === 'hidden' ? 'Hidden' : 'Visible'
		const selected = <span className="bolt-dropdown-filter-bar-item-selected-text">{text}</span>
		return this.props.showPlaceholderAsLabel === false ? selected : <>
			<span className="bolt-dropdown-filter-bar-item-placeholder">Visibility: </span>{selected}
		</>
	}
	private renderExpandable = (props: IDropdownExpandableProps) =>
		<DropdownExpandableButton {...props as any} renderSelectedItems={this.renderSelectedItems} />

	render() {
		const visibility = getFindingVisibility(this.props.filter)
		return <DropdownFilterBarItem key={this.dropdownGeneration} className="swcFindingVisibility"
			componentRef={item => this.item = item as any}
			filter={this.props.filter} filterItemKey="Triage"
			items={[
				{id: 'visible', text: `Visible (${this.props.visibleCount})`},
				{id: 'hidden', text: `Hidden (${this.props.hiddenCount})`},
			]}
			selection={this.selection} placeholder={visibility === 'none' ? 'Visibility: none' : 'Visibility'}
			renderExpandable={this.renderExpandable}
			toggleFilterBar={this.collapseAfterClear}
			showPlaceholderAsLabel={this.props.showPlaceholderAsLabel ?? true}
			ariaLabel="Finding visibility" />
	}
}
