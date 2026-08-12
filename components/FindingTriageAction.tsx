import * as React from 'react'
import {observer} from 'mobx-react'
import {Result} from 'sarif'
import {FindingTriage} from './FindingTriage'

@observer export class FindingTriageAction extends React.Component<{
	triage?: FindingTriage
	results: Result[]
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
		const verb = restore ? 'Restore' : 'Hide'
		const label = results.length === 1 ? verb : `${verb} ${results.length} findings`
		return <button type="button" className="swcFindingTriageAction"
			disabled={triage.pending} data-swc-tooltip={`${label} in this browser`}
			onClick={this.update}>{label}</button>
	}
}
