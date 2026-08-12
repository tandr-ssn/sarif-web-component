import * as React from 'react'
import {observer} from 'mobx-react'
import {Result} from 'sarif'
import {FindingTriage} from './FindingTriage'
import {Button} from './AzureDevOpsUi'

export const FINDING_TRIAGE_COLUMN_ID = '__finding-visibility'

function visibilityIcon(restore: boolean) {
	return {render: (className: string) => <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
		<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
		<circle cx="12" cy="12" r="2.5" />
		{!restore && <path d="m4 4 16 16" />}
	</svg>}
}

@observer export class FindingTriageAction extends React.Component<{
	triage?: FindingTriage
	results: Result[]
	compact?: boolean
}> {
	private update = async (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault()
		event.stopPropagation()
		const {triage, results} = this.props
		if (!triage) return
		const restore = triage.hiddenCount(results) === results.length
		try { await triage.setHidden(results, !restore) }
		catch (error) { window.alert(`Unable to save finding state: ${error instanceof Error ? error.message : error}`) }
	}

	render() {
		const {triage, results} = this.props
		if (!triage || !triage.ready || !results.length) return null
		const restore = triage.hiddenCount(results) === results.length
		const verb = restore ? 'Unhide' : 'Hide'
		const label = results.length === 1 ? `${verb} finding` : `${verb} ${results.length} findings`
		return <Button className={`swcFindingTriageAction${this.props.compact ? ' swcFindingTriageActionCompact' : ''}`}
			disabled={triage.pending} subtle={true} ariaLabel={label}
			tooltipProps={{text: `${label} in this browser`}}
			iconProps={this.props.compact ? visibilityIcon(restore) : undefined}
			text={this.props.compact ? undefined : label} onClick={this.update as any} />
	}
}

export class StickyFindingTriageAction extends React.Component<{
	triage?: FindingTriage
	results: Result[]
}> {
	private host?: HTMLDivElement
	private frame?: number
	private resizeObserver?: ResizeObserver

	componentDidMount() {
		window.addEventListener('scroll', this.schedulePosition, true)
		window.addEventListener('resize', this.schedulePosition)
		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver(this.schedulePosition)
			const row = this.host?.closest('.bolt-table-row')
			const controls = document.querySelector('.swcResultsControls')
			if (row) this.resizeObserver.observe(row)
			if (controls) this.resizeObserver.observe(controls)
		}
		this.schedulePosition()
	}

	componentDidUpdate() { this.schedulePosition() }

	componentWillUnmount() {
		window.removeEventListener('scroll', this.schedulePosition, true)
		window.removeEventListener('resize', this.schedulePosition)
		this.resizeObserver?.disconnect()
		if (this.frame !== undefined) cancelAnimationFrame(this.frame)
	}

	private schedulePosition = () => {
		if (this.frame !== undefined) return
		this.frame = requestAnimationFrame(() => {
			this.frame = undefined
			this.updatePosition()
		})
	}

	private updatePosition() {
		const host = this.host
		const cell = host?.closest('.swcFindingStickyCell') as HTMLElement | null
		const row = host?.closest('.bolt-table-row') as HTMLElement | null
		const controls = document.querySelector('.swcResultsControls') as HTMLElement | null
		if (!host || !cell || !row || !controls) return
		const rowBox = row.getBoundingClientRect()
		const cellBox = cell.getBoundingClientRect()
		const controlsBottom = controls.getBoundingClientRect().bottom
		const inset = 5
		const height = host.offsetHeight
		const stickyTop = controlsBottom + 8
		const shouldPin = rowBox.top + inset < stickyTop && rowBox.bottom - inset > controlsBottom
		if (shouldPin) {
			const top = Math.min(stickyTop, rowBox.bottom - height - inset)
			host.style.position = 'fixed'
			host.style.left = `${cellBox.left}px`
			host.style.top = `${Math.max(controlsBottom, top)}px`
			host.style.width = `${cellBox.width}px`
		} else {
			host.style.position = ''
			host.style.left = ''
			host.style.top = ''
			host.style.width = ''
		}
	}

	render() {
		return <div className="swcFindingStickyAction" ref={element => this.host = element ?? undefined}>
			<FindingTriageAction triage={this.props.triage} results={this.props.results} compact />
		</div>
	}
}
