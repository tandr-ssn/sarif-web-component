import './ResultExportMenu.scss'
import * as React from 'react'
import {makeObservable, observable} from 'mobx'
import {observer} from 'mobx-react'
import {Callout, Icon, IconSize, Location} from './AzureDevOpsUi'
import {ResultExportFormat, ResultExportScope} from './ResultExport'

@observer export class ResultExportMenu extends React.Component<{
	filteredCount: number
	allCount: number
	filtered: boolean
	onExport: (scope: ResultExportScope, format: ResultExportFormat) => void
}> {
	private open = false
	private anchor?: HTMLButtonElement

	constructor(props: ResultExportMenu['props']) {
		super(props)
		makeObservable<this, 'open'>(this, {open: observable})
	}

	render() {
		const {filteredCount, allCount, filtered, onExport} = this.props
		const scope = filtered ? 'filtered' : 'all'
		const count = filtered ? filteredCount : allCount
		const scopeLabel = filtered ? 'filtered' : 'visible'
		return <div className="swcResultExport">
			<button type="button" className="swcToolbarDropdownButton" ref={element => this.anchor = element ?? undefined}
				data-swc-tooltip={`Export ${count} findings using the selected Fields`}
				aria-expanded={this.open} aria-haspopup="menu"
				disabled={!count}
				onClick={() => this.open = !this.open}>
				<span className="swcToolbarDropdownLabel">Export: </span>
				<span className="swcToolbarDropdownValue">{scopeLabel}</span>
				<Icon ariaHidden={true} className="swcToolbarDropdownChevron" iconName="ChevronDownMed" size={IconSize.small} />
			</button>
			{this.open && this.anchor && <Callout anchorElement={this.anchor}
				anchorOrigin={{horizontal: Location.end, vertical: Location.end}}
				calloutOrigin={{horizontal: Location.end, vertical: Location.start}}
				blurDismiss={false} escDismiss={true} lightDismiss={true}
				onDismiss={() => this.open = false}>
				<div className="swcResultExportMenu" role="menu">
					<button type="button" role="menuitem" onClick={() => { this.open = false; onExport(scope, 'csv-plain') }}>CSV — plain text</button>
					<button type="button" role="menuitem" onClick={() => { this.open = false; onExport(scope, 'csv-raw') }}>CSV — raw values</button>
					<button type="button" role="menuitem" onClick={() => { this.open = false; onExport(scope, 'tsv') }}>TSV</button>
					<button type="button" role="menuitem" onClick={() => { this.open = false; onExport(scope, 'html') }}>HTML — report</button>
					<button type="button" role="menuitem" onClick={() => { this.open = false; onExport(scope, 'html-table') }}>HTML — table</button>
					<button type="button" role="menuitem" onClick={() => { this.open = false; onExport(scope, 'text') }}>Plain text</button>
					<button type="button" role="menuitem" onClick={() => { this.open = false; onExport(scope, 'markdown') }}>Markdown</button>
				</div>
			</Callout>}
		</div>
	}
}
