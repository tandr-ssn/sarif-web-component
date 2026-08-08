// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './ExecutionTrace.scss'
import * as React from 'react'
import {Location, PhysicalLocation, Result, Run, Stack, ThreadFlow, ThreadFlowLocation} from 'sarif'
import {getLogicalLocationText, SourceLocationLink} from './SourceLocationLink'
import {SourceTrace, traceColor} from './SourceFile'
import {Snippet} from './Snippet'
import {getResultAcahOrigin} from './ResultSourceTrace'
import {codeFlowText, stackText} from './ResultTraceText'
import {getResultAcah, getTraceStepRole, getTraceStepSymbol} from './Acah'

function messageText(message): string | undefined {
	return message?.text ?? message?.markdown
}

function readableAcahValue(value: string): string {
	const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
	return words ? words[0].toUpperCase() + words.slice(1) : words
}

function acahTraceSummary(result: Result): {label: string, title: string} | undefined {
	const trace = getResultAcah(result)?.trace
	if (typeof trace?.status !== 'string' || !trace.status) return undefined
	const label = readableAcahValue(trace.status)
	const scope = typeof trace.scope === 'string' && trace.scope ? readableAcahValue(trace.scope) : undefined
	const reason = typeof trace.reason === 'string' && trace.reason ? trace.reason : undefined
	return {label, title: [
		`${label} trace within ACAH's bounded static model${scope ? ` · ${scope}` : ''}`,
		'This does not prove runtime reachability or exploitability.', reason,
	].filter(Boolean).join('\n')}
}

function TraceLocation(props: {
	location?: Location
	module?: string
	run: Run
	index?: number
	traceLocations?: Array<PhysicalLocation | undefined>
	traceSteps?: Array<ThreadFlowLocation | undefined>
	traceLabel?: string
	showSnippet?: boolean
	identifierHints?: Array<string | undefined>
	inferIdentifiers?: boolean
	traceCount?: number
	origin?: SourceTrace['origin']
}) {
	const {location, module, run, index, traceLocations, traceSteps, traceLabel, showSnippet, identifierHints, inferIdentifiers, traceCount, origin} = props
	const logicalName = getLogicalLocationText(location)
	const message = messageText(location?.message)
	const prefix = index === undefined ? undefined : <span className="swcTraceIndex">{index + 1}</span>
	const traceRole = index === undefined ? undefined : getTraceStepRole(traceSteps?.[index], run)
	if (!logicalName && !message && !module && !location?.physicalLocation) return null

	const trace: SourceTrace | undefined = index === undefined || !traceLocations
		? undefined
		: {
			locations: traceLocations,
			activeIndex: index,
			label: traceLabel,
			...(traceSteps ? {steps: traceSteps} : {}),
			...(identifierHints?.some(Boolean) ? {identifierHints} : {}),
			...(inferIdentifiers ? {inferIdentifiers: true} : {}),
			...(origin ? {origin} : {}),
		}
	return <li className="swcTraceLocation">
		{prefix}
		<div>
			{(logicalName || module) && <div className="swcTraceName">{logicalName ?? module}</div>}
			{message && message !== logicalName && <div className="swcTraceLocationMessage">{message}</div>}
			<SourceLocationLink ploc={location?.physicalLocation} run={run} trace={trace} />
			{showSnippet && <Snippet ploc={location?.physicalLocation} run={run} trace={trace}
				highlightColor={index === undefined ? undefined : traceColor(index, traceCount ?? traceLocations?.length ?? 1, traceRole)} />}
		</div>
	</li>
}

function StackFrames(props: { stack: Stack, run: Run, label?: string, origin?: SourceTrace['origin'] }) {
	const traceLocations = props.stack.frames?.map(frame => frame.location?.physicalLocation) ?? []
	return <ol className="swcTraceLocations">
		{props.stack.frames?.map((frame, index) =>
			<TraceLocation key={index} location={frame.location} module={frame.module} run={props.run}
				index={index} traceLocations={traceLocations} traceLabel={props.label ?? 'Call stack'}
				traceCount={traceLocations.length} showSnippet={true} origin={props.origin} />)}
	</ol>
}

function ResultStacks(props: { result: Result, run: Run }) {
	if (!props.result.stacks?.length) return null
	return <>
		{props.result.stacks.map((stack, index) => {
			const label = `Call stack${props.result.stacks.length > 1 ? ` ${index + 1}` : ''}`
			return <details className="swcTrace" key={index}
				data-copy-trace-value={stackText(props.result, stack, index, props.result.stacks.length)}>
				<summary>{label} ({stack.frames?.length ?? 0} frames)</summary>
				{messageText(stack.message) && <div className="swcTraceMessage">{messageText(stack.message)}</div>}
				<StackFrames stack={stack} run={props.run} label={label} origin={getResultAcahOrigin(props.result)} />
			</details>
		})}
	</>
}

function ThreadFlowTrace(props: { threadFlow: ThreadFlow, threadFlowCount: number, threadFlowIndex: number, label: string, run: Run, origin?: SourceTrace['origin'] }) {
	const {threadFlow, threadFlowCount, threadFlowIndex, label, run} = props
	const resolvedLocations = threadFlow.locations?.map(threadFlowLocation => threadFlowLocation.index === undefined
		? threadFlowLocation
		: run.threadFlowLocations?.[threadFlowLocation.index]) ?? []
	const traceLocations = resolvedLocations.map(resolved => resolved?.location?.physicalLocation)
	const identifierHints = resolvedLocations.map(resolved => {
		const acahSymbol = getTraceStepSymbol(resolved, run)
		if (acahSymbol) return acahSymbol
		const identifiers = Object.keys(resolved?.state ?? {}).filter(key => /^[A-Za-z_$][\w$]*$/.test(key))
		return identifiers.length === 1 ? identifiers[0] : undefined
	})
	return <div className="swcThreadFlow">
		{(threadFlowCount > 1 || threadFlow.message || threadFlow.id) && <div className="swcThreadFlowTitle">
			{messageText(threadFlow.message) ?? threadFlow.id ?? `Thread ${threadFlowIndex + 1}`}
		</div>}
		<ol className="swcTraceLocations">
			{resolvedLocations.map((resolved, locationIndex) => <React.Fragment key={locationIndex}>
				<TraceLocation location={resolved?.location} module={resolved?.module} run={run}
					index={locationIndex} traceLocations={traceLocations} traceSteps={resolvedLocations} traceLabel={label} showSnippet={true}
					identifierHints={identifierHints} inferIdentifiers={true} traceCount={traceLocations.length} origin={props.origin} />
				{resolved?.stack && <li className="swcNestedStack"><StackFrames stack={resolved.stack} run={run} label="Nested stack" origin={props.origin} /></li>}
			</React.Fragment>)}
		</ol>
	</div>
}

function CodeFlows(props: { result: Result, run: Run }) {
	if (!props.result.codeFlows?.length) return null
	const traceSummary = acahTraceSummary(props.result)
	return <>
		{props.result.codeFlows.map((codeFlow, codeFlowIndex) => {
			const label = `Code flow${props.result.codeFlows.length > 1 ? ` ${codeFlowIndex + 1}` : ''}`
			const stepCount = codeFlow.threadFlows?.reduce((total, threadFlow) => total + (threadFlow.locations?.length ?? 0), 0) ?? 0
			return <details className="swcTrace" key={codeFlowIndex}
				data-copy-trace-value={codeFlowText(props.result, codeFlow, codeFlowIndex, props.result.codeFlows.length)}>
			<summary>{label} ({stepCount} {stepCount === 1 ? 'step' : 'steps'})
				{traceSummary && <span className="swcTraceStatus" title={traceSummary.title}> · {traceSummary.label}</span>}
			</summary>
			{messageText(codeFlow.message) && <div className="swcTraceMessage">{messageText(codeFlow.message)}</div>}
			{codeFlow.threadFlows?.map((threadFlow, threadFlowIndex) => <ThreadFlowTrace
				key={threadFlowIndex}
				threadFlow={threadFlow}
				threadFlowCount={codeFlow.threadFlows.length}
				threadFlowIndex={threadFlowIndex}
				label={codeFlow.threadFlows.length > 1 ? `${label} · Thread ${threadFlowIndex + 1}` : label}
				run={props.run}
				origin={getResultAcahOrigin(props.result)} />)}
		</details>})}
	</>
}

export function ExecutionTrace(props: { result: Result }) {
	const run = props.result.run
	return <>
		<ResultStacks result={props.result} run={run} />
		<CodeFlows result={props.result} run={run} />
	</>
}
