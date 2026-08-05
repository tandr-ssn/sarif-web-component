// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import {Location, PhysicalLocation, Run} from 'sarif'
import {getRepoUri} from './getRepoUri'
import {getArtifactContents, getArtifactLocation, openSourceFile, SourceFileReader, SourceFileReaderContext, SourceFileSelectionContext} from './SourceFile'

function locationText(ploc: PhysicalLocation | undefined, run: Run): string | undefined {
	const artifactLocation = getArtifactLocation(ploc, run)
	if (!artifactLocation?.uri) return undefined
	const line = ploc?.region?.startLine
	return line ? `${artifactLocation.uri}:${line}` : artifactLocation.uri
}

function SourceLocationLinkWithReader(props: {
	ploc: PhysicalLocation
	run: Run
	reader?: SourceFileReader
	selectSourceFiles?: () => void
	children?: React.ReactNode
}) {
	const {ploc, run, reader, selectSourceFiles} = props
	const artifactLocation = getArtifactLocation(ploc, run)
	const text = props.children ?? locationText(ploc, run)
	if (!text) return null
	if (!artifactLocation) return <>{text}</>

	const canReadLocally = !!reader || getArtifactContents(artifactLocation, run) !== undefined
	if (canReadLocally) {
		return <a href="#" onClick={event => {
			event.preventDefault()
			event.stopPropagation()
			void openSourceFile(artifactLocation, run, ploc.region, reader)
		}} title="View source file">{text}</a>
	}

	const explicitHref = artifactLocation.properties?.['href'] as string | undefined
	const remoteHref = explicitHref ?? getRepoUri(artifactLocation.uri, run, ploc.region)
	if (remoteHref) return <a href={remoteHref} target="_blank" rel="noopener noreferrer">{text}</a>
	if (selectSourceFiles) {
		return <a href="#" onClick={event => {
			event.preventDefault()
			event.stopPropagation()
			selectSourceFiles()
		}} title="Choose a source folder, then click the file again">{text}</a>
	}
	return <>{text}</>
}

export function SourceLocationLink(props: { ploc?: PhysicalLocation, run: Run, children?: React.ReactNode }) {
	if (!props.ploc) return props.children ? <>{props.children}</> : null
	return <SourceFileReaderContext.Consumer>
		{reader => <SourceFileSelectionContext.Consumer>
			{selectSourceFiles => <SourceLocationLinkWithReader
				ploc={props.ploc}
				run={props.run}
				reader={reader}
				selectSourceFiles={selectSourceFiles}
				children={props.children} />}
		</SourceFileSelectionContext.Consumer>}
	</SourceFileReaderContext.Consumer>
}

export function getLogicalLocationText(location: Location | undefined): string | undefined {
	const logicalLocation = location?.logicalLocations?.[0]
	return logicalLocation?.fullyQualifiedName ?? logicalLocation?.decoratedName ?? logicalLocation?.name
}
