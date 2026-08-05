// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './ExecutionTrace.scss'
import * as React from 'react'
import {Location, PhysicalLocation, Result, Run, Stack, ThreadFlow} from 'sarif'
import {getLogicalLocationText, SourceLocationLink} from './SourceLocationLink'
import {SourceTrace} from './SourceFile'

function messageText(message): string | undefined {
	return message?.text ?? message?.markdown
}

function TraceLocation(props: {
	location?: Location
	module?: string
	run: Run
	index?: number
	traceLocations?: Array<PhysicalLocation | undefined>
	traceLabel?: string
}) {
	const {location, module, run, index, traceLocations, traceLabel} = props
	const logicalName = getLogicalLocationText(location)
	const message = messageText(location?.message)
	const prefix = index === undefined ? undefined : <span className="swcTraceIndex">{index + 1}</span>
	if (!logicalName && !message && !module && !location?.physicalLocation) return null

	const trace: SourceTrace | undefined = index === undefined || !traceLocations
		? undefined
		: { locations: traceLocations, activeIndex: index, label: traceLabel }
	return <li className="swcTraceLocation">
		{prefix}
		<div>
			{(logicalName || module) && <div className="swcTraceName">{logicalName ?? module}</div>}
			{message && message !== logicalName && <div>{message}</div>}
			<SourceLocationLink ploc={location?.physicalLocation} run={run} trace={trace} />
		</div>
	</li>
}

function StackFrames(props: { stack: Stack, run: Run, label?: string }) {
	const traceLocations = props.stack.frames?.map(frame => frame.location?.physicalLocation) ?? []
	return <ol className="swcTraceLocations">
		{props.stack.frames?.map((frame, index) =>
			<TraceLocation key={index} location={frame.location} module={frame.module} run={props.run}
				index={index} traceLocations={traceLocations} traceLabel={props.label ?? 'Call stack'} />)}
	</ol>
}

function ResultStacks(props: { result: Result, run: Run }) {
	if (!props.result.stacks?.length) return null
	return <>
		{props.result.stacks.map((stack, index) => {
			const label = `Call stack${props.result.stacks.length > 1 ? ` ${index + 1}` : ''}`
			return <details className="swcTrace" key={index}>
				<summary>{label} ({stack.frames?.length ?? 0} frames)</summary>
				{messageText(stack.message) && <div className="swcTraceMessage">{messageText(stack.message)}</div>}
				<StackFrames stack={stack} run={props.run} label={label} />
			</details>
		})}
	</>
}

function ThreadFlowTrace(props: { threadFlow: ThreadFlow, threadFlowCount: number, threadFlowIndex: number, label: string, run: Run }) {
	const {threadFlow, threadFlowCount, threadFlowIndex, label, run} = props
	const resolvedLocations = threadFlow.locations?.map(threadFlowLocation => threadFlowLocation.index === undefined
		? threadFlowLocation
		: run.threadFlowLocations?.[threadFlowLocation.index]) ?? []
	const traceLocations = resolvedLocations.map(resolved => resolved?.location?.physicalLocation)
	return <div className="swcThreadFlow">
		{(threadFlowCount > 1 || threadFlow.message || threadFlow.id) && <div className="swcThreadFlowTitle">
			{messageText(threadFlow.message) ?? threadFlow.id ?? `Thread ${threadFlowIndex + 1}`}
		</div>}
		<ol className="swcTraceLocations">
			{resolvedLocations.map((resolved, locationIndex) => <React.Fragment key={locationIndex}>
				<TraceLocation location={resolved?.location} module={resolved?.module} run={run}
					index={locationIndex} traceLocations={traceLocations} traceLabel={label} />
				{resolved?.stack && <li className="swcNestedStack"><StackFrames stack={resolved.stack} run={run} label="Nested stack" /></li>}
			</React.Fragment>)}
		</ol>
	</div>
}

function CodeFlows(props: { result: Result, run: Run }) {
	if (!props.result.codeFlows?.length) return null
	return <>
		{props.result.codeFlows.map((codeFlow, codeFlowIndex) => {
			const label = `Code flow${props.result.codeFlows.length > 1 ? ` ${codeFlowIndex + 1}` : ''}`
			return <details className="swcTrace" key={codeFlowIndex}>
			<summary>{label}</summary>
			{messageText(codeFlow.message) && <div className="swcTraceMessage">{messageText(codeFlow.message)}</div>}
			{codeFlow.threadFlows?.map((threadFlow, threadFlowIndex) => <ThreadFlowTrace
				key={threadFlowIndex}
				threadFlow={threadFlow}
				threadFlowCount={codeFlow.threadFlows.length}
				threadFlowIndex={threadFlowIndex}
				label={codeFlow.threadFlows.length > 1 ? `${label} · Thread ${threadFlowIndex + 1}` : label}
				run={props.run} />)}
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
