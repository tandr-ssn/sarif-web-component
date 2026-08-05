// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './ExecutionTrace.scss'
import * as React from 'react'
import {Location, Result, Run, Stack} from 'sarif'
import {getLogicalLocationText, SourceLocationLink} from './SourceLocationLink'

function messageText(message): string | undefined {
	return message?.text ?? message?.markdown
}

function TraceLocation(props: { location?: Location, module?: string, run: Run, index?: number }) {
	const {location, module, run, index} = props
	const logicalName = getLogicalLocationText(location)
	const message = messageText(location?.message)
	const prefix = index === undefined ? undefined : <span className="swcTraceIndex">{index + 1}</span>
	if (!logicalName && !message && !module && !location?.physicalLocation) return null

	return <li className="swcTraceLocation">
		{prefix}
		<div>
			{(logicalName || module) && <div className="swcTraceName">{logicalName ?? module}</div>}
			{message && message !== logicalName && <div>{message}</div>}
			<SourceLocationLink ploc={location?.physicalLocation} run={run} />
		</div>
	</li>
}

function StackFrames(props: { stack: Stack, run: Run }) {
	return <ol className="swcTraceLocations">
		{props.stack.frames?.map((frame, index) =>
			<TraceLocation key={index} location={frame.location} module={frame.module} run={props.run} index={index} />)}
	</ol>
}

function ResultStacks(props: { result: Result, run: Run }) {
	if (!props.result.stacks?.length) return null
	return <>
		{props.result.stacks.map((stack, index) => <details className="swcTrace" key={index}>
			<summary>Call stack{props.result.stacks.length > 1 ? ` ${index + 1}` : ''} ({stack.frames?.length ?? 0} frames)</summary>
			{messageText(stack.message) && <div className="swcTraceMessage">{messageText(stack.message)}</div>}
			<StackFrames stack={stack} run={props.run} />
		</details>)}
	</>
}

function CodeFlows(props: { result: Result, run: Run }) {
	if (!props.result.codeFlows?.length) return null
	return <>
		{props.result.codeFlows.map((codeFlow, codeFlowIndex) => <details className="swcTrace" key={codeFlowIndex}>
			<summary>Code flow{props.result.codeFlows.length > 1 ? ` ${codeFlowIndex + 1}` : ''}</summary>
			{messageText(codeFlow.message) && <div className="swcTraceMessage">{messageText(codeFlow.message)}</div>}
			{codeFlow.threadFlows?.map((threadFlow, threadFlowIndex) => <div className="swcThreadFlow" key={threadFlowIndex}>
				{(codeFlow.threadFlows.length > 1 || threadFlow.message || threadFlow.id) && <div className="swcThreadFlowTitle">
					{messageText(threadFlow.message) ?? threadFlow.id ?? `Thread ${threadFlowIndex + 1}`}
				</div>}
				<ol className="swcTraceLocations">
					{threadFlow.locations?.map((threadFlowLocation, locationIndex) => {
						const resolved = threadFlowLocation.index === undefined
							? threadFlowLocation
							: props.run.threadFlowLocations?.[threadFlowLocation.index]
						return <React.Fragment key={locationIndex}>
							<TraceLocation location={resolved?.location} module={resolved?.module} run={props.run} index={locationIndex} />
							{resolved?.stack && <li className="swcNestedStack"><StackFrames stack={resolved.stack} run={props.run} /></li>}
						</React.Fragment>
					})}
				</ol>
			</div>)}
		</details>)}
	</>
}

export function ExecutionTrace(props: { result: Result }) {
	const run = props.result.run
	return <>
		<ResultStacks result={props.result} run={run} />
		<CodeFlows result={props.result} run={run} />
	</>
}
