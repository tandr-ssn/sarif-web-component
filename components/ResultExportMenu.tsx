import './ResultExportMenu.scss'
import * as React from 'react'
import {ResultExportScope} from './ResultExport'

export class ResultExportMenu extends React.Component<{
	filteredCount: number
	allCount: number
	filtered: boolean
	onExport: (scope: ResultExportScope) => void
}> {
	render() {
		const {filteredCount, allCount, filtered, onExport} = this.props
		const scope = filtered ? 'filtered' : 'all'
		const count = filtered ? filteredCount : allCount
		return <div className="swcResultExport">
			<button type="button"
				title={`Export ${count} findings using the selected Fields columns`}
				disabled={!count}
				onClick={() => onExport(scope)}>Export {scope}</button>
		</div>
	}
}
