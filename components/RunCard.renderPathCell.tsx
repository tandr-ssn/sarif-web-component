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

// TODO:
// Unify runArt vs resultArt.
// Distinguish uri and text.
export function renderPathCell(result: Result, embedded = false) {
	const ploc = result.locations?.[0]?.physicalLocation
	const resArtLoc
	    =  ploc?.artifactLocation
		?? result.analysisTarget
	const runArt = result.run.artifacts?.[resArtLoc?.index ?? -1]
	const runArtLoc = runArt?.location
	const description = resArtLoc?.description?.text
		?? runArtLoc?.description?.text // vs runArt?.description?.text?
	const artifactUri = resArtLoc?.uri
		?? runArtLoc?.uri // Commonly a relative URI.
	const uri = description ?? artifactUri

	const region = ploc?.region
	const position = region?.startLine
		? `:${region.startLine}${region.startColumn ? `:${region.startColumn}` : ''}`
		: ''
	const uriWithEllipsis = <SourcePathText uri={uri} position={position} rootRelative={!description}
		run={result.run} artifactLocation={resArtLoc ?? runArtLoc} />
	
	// Example of href scenario:
	// uri  = src\Prototypes\README.md
	// href = https://org.visualstudio.com/project/_git/repo?path=%2Fsrc%2FPrototypes%2FREADME.md&_a=preview
	const href = resArtLoc?.properties?.['href']
	const sourcePhysicalLocation = ploc ?? (result.analysisTarget
		? { artifactLocation: result.analysisTarget } as PhysicalLocation
		: undefined)
	const sourceLocationText = getSourceLocationText(sourcePhysicalLocation, result.run)
	const sourceTrace = getResultSourceTrace(result)
	if (embedded) {
		return <div className="swcFindingPath" data-swc-tooltip={sourceLocationText ?? uri}>
			<SourceLocationLink ploc={sourcePhysicalLocation} run={result.run} trace={sourceTrace}>
				{uriWithEllipsis}
			</SourceLocationLink>
		</div>
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
					<span className="fontSize font-size secondary-text swcColorUnset swcWidth100" data-swc-tooltip={sourceLocationText ?? uri}>
						<SourceLocationLink ploc={sourcePhysicalLocation} run={result.run} trace={sourceTrace}>{uriWithEllipsis}</SourceLocationLink>
					</span>
				</div>
			})}
		</div>,
		() => <div className="flex-row scroll-hidden">{/* From Advanced table demo. */}
			<span className="swcColorUnset" data-swc-tooltip={sourceLocationText ?? uri}>
				<SourceLocationLink ploc={sourcePhysicalLocation} run={result.run} trace={sourceTrace}>{uriWithEllipsis}</SourceLocationLink>
			</span>
		</div>
	)
}
