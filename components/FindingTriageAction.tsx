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
