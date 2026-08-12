// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import { PhysicalLocation, Result } from 'sarif'
import { Hi } from './Hi'
import './RunCard.renderCell.scss'
import { getSourceLocationText, SourceLocationLink } from './SourceLocationLink'
import { getResultSourceTrace } from './ResultSourceTrace'
import { tryOr } from './try'
import {SourcePathFormatterContext} from './SourceFile'
import {getArtifactLocation} from './SourceFileResolver'

function SourcePathText(props: {uri?: string, position: string, rootRelative?: boolean, run: Result['run'], artifactLocation?: Result['analysisTarget']}) {
	const formatPath = React.useContext(SourcePathFormatterContext)
	if (!props.uri) return <Hi>—</Hi>
	const uri = props.rootRelative ? formatPath?.(props.uri, props.run, props.artifactLocation) ?? props.uri : props.uri
	const index = uri.lastIndexOf('/')
	if (index < 0) return <Hi>{uri}{props.position}</Hi>
	return <span className="midEllipsis">
		<span><Hi>{uri.slice(0, index)}</Hi></span>
		<span><Hi>/{uri.slice(index + 1)}{props.position}</Hi></span>
	</span>
}

function PathTooltip(props: {
	className?: string
	element?: 'div' | 'span'
	ploc?: PhysicalLocation
	run: Result['run']
	fallback?: string
	children: React.ReactNode
}) {
	const formatPath = React.useContext(SourcePathFormatterContext)
	const text = getSourceLocationText(props.ploc, props.run, formatPath) ?? props.fallback
	const Element = props.element ?? 'span'
	return <Element className={props.className} data-swc-tooltip={text}>{props.children}</Element>
}

export function renderPathCell(result: Result, embedded = false) {
	const ploc = result.locations?.[0]?.physicalLocation
	const resultArtifactLocation
	    =  ploc?.artifactLocation
		?? result.analysisTarget
	const runArtifact = result.run.artifacts?.[resultArtifactLocation?.index ?? -1]
	const artifactLocation = getArtifactLocation(
		resultArtifactLocation ? {artifactLocation: resultArtifactLocation} : undefined,
		result.run,
	)
	const description = resultArtifactLocation?.description?.text
		?? runArtifact?.location?.description?.text
		?? runArtifact?.description?.text
	const artifactUri = artifactLocation?.uri // Commonly a relative URI.
	const uri = description ?? artifactUri

	const region = ploc?.region
	const position = region?.startLine
		? `:${region.startLine}${region.startColumn ? `:${region.startColumn}` : ''}`
		: ''
	const uriWithEllipsis = <SourcePathText uri={uri} position={position} rootRelative={!description}
		run={result.run} artifactLocation={artifactLocation} />
	
	// Example of href scenario:
	// uri  = src\Prototypes\README.md
	// href = https://org.visualstudio.com/project/_git/repo?path=%2Fsrc%2FPrototypes%2FREADME.md&_a=preview
	const href = artifactLocation?.properties?.['href']
	const sourcePhysicalLocation = ploc ?? (result.analysisTarget
		? { artifactLocation: result.analysisTarget } as PhysicalLocation
		: undefined)
	const sourceTrace = getResultSourceTrace(result)
	if (embedded) {
		return <PathTooltip element="div" className="swcFindingPath" ploc={sourcePhysicalLocation} run={result.run} fallback={uri}>
			<SourceLocationLink ploc={sourcePhysicalLocation} run={result.run} trace={sourceTrace}>
				{uriWithEllipsis}
			</SourceLocationLink>
		</PathTooltip>
	}

	const rowClasses = 'bolt-table-two-line-cell-item flex-row scroll-hidden'

	return tryOr(
		() => <div className="flex-column scroll-hidden">
			<div className={rowClasses}>
				<div className="fontsize font-size swcWidth100" data-swc-tooltip={result.locations[0].logicalLocations[0].fullyQualifiedName}>
					<pre style={{ margin: 0 }}><code><Hi>{result.locations[0].logicalLocations[0].fullyQualifiedName}</Hi></code></pre>
				</div>
			</div>
			{tryOr(() => {
				if (!uri) throw undefined
				return <div className={rowClasses}>
					<PathTooltip className="fontSize font-size secondary-text swcColorUnset swcWidth100" ploc={sourcePhysicalLocation} run={result.run} fallback={uri}>
						<SourceLocationLink ploc={sourcePhysicalLocation} run={result.run} trace={sourceTrace}>{uriWithEllipsis}</SourceLocationLink>
					</PathTooltip>
				</div>
			})}
		</div>,
		() => <div className="flex-row scroll-hidden">{/* From Advanced table demo. */}
			<PathTooltip className="swcColorUnset" ploc={sourcePhysicalLocation} run={result.run} fallback={uri}>
				<SourceLocationLink ploc={sourcePhysicalLocation} run={result.run} trace={sourceTrace}>{uriWithEllipsis}</SourceLocationLink>
			</PathTooltip>
		</div>
	)
}
