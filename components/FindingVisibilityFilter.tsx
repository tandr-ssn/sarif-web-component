import * as React from 'react'
import {observer} from 'mobx-react'
import {MobxFilter} from './FilterBar'

export type FindingVisibility = 'visible' | 'hidden' | 'all'

export function getFindingVisibility(filter: MobxFilter): FindingVisibility {
	const values = filter.getState().Triage?.value as string[] | undefined
	if (values?.includes('visible') && values.includes('hidden')) return 'all'
	if (values?.includes('hidden')) return 'hidden'
	return 'visible'
}

@observer export class FindingVisibilityFilter extends React.Component<{
	filter: MobxFilter
	visibleCount: number
	hiddenCount: number
}> {
	private setVisibility = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const visibility = event.target.value as FindingVisibility
		this.props.filter.setFilterItemState('Triage', {value: visibility === 'all'
			? ['visible', 'hidden']
			: [visibility]})
	}

	render() {
		const {visibleCount, hiddenCount} = this.props
		return <label className="swcFindingVisibility">
			<span>Findings</span>
			<select aria-label="Finding visibility" value={getFindingVisibility(this.props.filter)} onChange={this.setVisibility}>
				<option value="visible">Visible ({visibleCount})</option>
				<option value="hidden">Hidden ({hiddenCount})</option>
				<option value="all">All ({visibleCount + hiddenCount})</option>
			</select>
		</label>
	}
}
