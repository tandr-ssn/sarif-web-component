import './ResultExportMenu.scss'
import * as React from 'react'
import {observable} from 'mobx'
import {observer} from 'mobx-react'
import {Callout} from 'azure-devops-ui/Callout'
import {Location} from 'azure-devops-ui/Utilities/Position'
import {ResultExportScope} from './ResultExport'

@observer
export class ResultExportMenu extends React.Component<{
	filteredCount: number
	allCount: number
	onExport: (scope: ResultExportScope) => void
}> {
	@observable private open = false
	private anchor?: HTMLButtonElement

	private export = (scope: ResultExportScope) => {
		this.props.onExport(scope)
		this.open = false
	}

	render() {
		const {filteredCount, allCount} = this.props
		return <div className="swcResultExport">
			<button type="button" ref={element => this.anchor = element ?? undefined}
				title="Export findings using the selected Fields columns"
				aria-expanded={this.open} aria-haspopup="menu" disabled={!allCount}
				onClick={() => this.open = !this.open}>Export...</button>
			{this.open && this.anchor && <Callout anchorElement={this.anchor}
				anchorOrigin={{horizontal: Location.start, vertical: Location.end}}
				calloutOrigin={{horizontal: Location.start, vertical: Location.start}}
				blurDismiss={false} escDismiss={true} lightDismiss={true}
				onDismiss={() => this.open = false}>
				<div className="swcResultExportMenu" role="menu">
					<button type="button" role="menuitem" disabled={!filteredCount}
						onClick={() => this.export('filtered')}>Export filtered findings ({filteredCount})</button>
					<button type="button" role="menuitem"
						onClick={() => this.export('all')}>Export all findings ({allCount})</button>
				</div>
			</Callout>}
		</div>
	}
}
