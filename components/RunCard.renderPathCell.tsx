// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import { PhysicalLocation, Result } from 'sarif'
import { Hi } from './Hi'
import './RunCard.renderCell.scss'
import { getSourceLocationText, SourceLocationLink } from './SourceLocationLink'
import { getResultSourceTrace } from './ResultSourceTrace'
import { tryOr } from './try'

// TODO:
// Unify runArt vs resultArt.
// Distinguish uri and text.
export function renderPathCell(result: Result) {
	const ploc = result.locations?.[0]?.physicalLocation
	const resArtLoc
	    =  ploc?.artifactLocation
		?? result.analysisTarget
	const runArt = result.run.artifacts?.[resArtLoc?.index ?? -1]
	const runArtLoc = runArt?.location
	const uri
		=  resArtLoc?.description?.text
		?? runArtLoc?.description?.text // vs runArt?.description?.text?
		?? resArtLoc?.uri
		?? runArtLoc?.uri // Commonly a relative URI.

	const [path, fileName] = (() => {
		if (!uri) return ['—']
		const index = uri.lastIndexOf('/')
		return index >= 0
			? [uri.slice(0, index), uri.slice(index + 1)]
			: [uri]
	})()
	const uriWithEllipsis = fileName // This is what ultimately gets displayed
		? <span className="midEllipsis">
			<span><Hi>{path}</Hi></span>
			<span><Hi>/{fileName}</Hi></span>
		</span>
		: <Hi>{uri ?? '—'}</Hi>
	
	// Example of href scenario:
	// uri  = src\Prototypes\README.md
	// href = https://org.visualstudio.com/project/_git/repo?path=%2Fsrc%2FPrototypes%2FREADME.md&_a=preview
	const href = resArtLoc?.properties?.['href']
	const sourcePhysicalLocation = ploc ?? (result.analysisTarget
		? { artifactLocation: result.analysisTarget } as PhysicalLocation
		: undefined)
	const sourceLocationText = getSourceLocationText(sourcePhysicalLocation, result.run)
	const sourceTrace = getResultSourceTrace(result)

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
