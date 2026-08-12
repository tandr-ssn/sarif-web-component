// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import {Location, PhysicalLocation, Run} from 'sarif'
import {Dialog} from './AzureDevOpsUi'
import {getRepoUri} from './getRepoUri'
import {getArtifactContents, getArtifactLocation, openSourceFile, SourceFileReader, SourceFileReaderContext, SourceFileSelectionContext, SourceNavigation, SourceNavigationContext, SourcePathFormatter, SourcePathFormatterContext, SourceTrace} from './SourceFile'
import {safeLinkHref} from './SafeLink'

export function getSourceLocationText(ploc: PhysicalLocation | undefined, run: Run, formatPath?: SourcePathFormatter): string | undefined {
	const artifactLocation = getArtifactLocation(ploc, run)
	if (!artifactLocation?.uri) return undefined
	const path = formatPath?.(artifactLocation.uri, run, artifactLocation) ?? artifactLocation.uri
	const line = ploc?.region?.startLine
	const column = ploc?.region?.startColumn
	return line ? `${path}:${line}${column ? `:${column}` : ''}` : path
}

function SourceLocationLinkWithReader(props: {
	ploc: PhysicalLocation
	run: Run
	reader?: SourceFileReader
	selectSourceFiles?: () => void
	formatPath?: SourcePathFormatter
	navigation?: SourceNavigation
	trace?: SourceTrace
	children?: React.ReactNode
	className?: string
}) {
	const [confirmSourceSelection, setConfirmSourceSelection] = React.useState(false)
	const {ploc, run, reader, selectSourceFiles, formatPath, trace, navigation} = props
	const artifactLocation = getArtifactLocation(ploc, run)
	const sourceLocationText = getSourceLocationText(ploc, run, formatPath)
	const text = props.children ?? getSourceLocationText(ploc, run, formatPath)
	if (!text) return null
	if (!artifactLocation) return <>{text}</>

	const canReadLocally = !!reader || getArtifactContents(artifactLocation, run) !== undefined
	if (canReadLocally) {
		return <a href="#" className={props.className} onClick={event => {
			event.preventDefault()
			event.stopPropagation()
			void openSourceFile(artifactLocation, run, ploc.region, reader, trace, formatPath, navigation, navigation?.byLocation.get(ploc)?.id)
		}} data-swc-tooltip={sourceLocationText}>{text}</a>
	}

	const explicitHref = artifactLocation.properties?.['href'] as string | undefined
	const remoteHref = safeLinkHref(explicitHref ?? getRepoUri(artifactLocation.uri, run, ploc.region))
	if (remoteHref) return <a href={remoteHref} className={props.className} target="_blank" rel="noopener noreferrer" data-swc-tooltip={sourceLocationText}>{text}</a>
	if (selectSourceFiles) {
		return <>
			<a href="#" className={props.className} onClick={event => {
				event.preventDefault()
				event.stopPropagation()
				setConfirmSourceSelection(true)
			}} data-swc-tooltip={sourceLocationText}>{text}</a>
			{confirmSourceSelection && <Dialog
				titleProps={{text: 'Local source folder required'}}
				onDismiss={() => setConfirmSourceSelection(false)}
				escDismiss={true}
				lightDismiss={true}
				footerButtonProps={[
					{
						text: 'Choose source folder...',
						primary: true,
						autoFocus: true,
						onClick: () => {
							setConfirmSourceSelection(false)
							selectSourceFiles()
						},
					},
					{text: 'Cancel', onClick: () => setConfirmSourceSelection(false)},
				]}>
				<p>To view this source file, select the top-level local folder containing the files referenced by the SARIF report.</p>
				<p>The browser will ask for read access to that folder. Files stay on your computer and are not uploaded or sent over the network.</p>
			</Dialog>}
		</>
	}
	return <>{text}</>
}

export function SourceLocationLink(props: { ploc?: PhysicalLocation, run: Run, trace?: SourceTrace, children?: React.ReactNode, className?: string }) {
	const reader = React.useContext(SourceFileReaderContext)
	const selectSourceFiles = React.useContext(SourceFileSelectionContext)
	const formatPath = React.useContext(SourcePathFormatterContext)
	const navigation = React.useContext(SourceNavigationContext)
	if (!props.ploc) return props.children ? <>{props.children}</> : null
	return <SourceLocationLinkWithReader
		ploc={props.ploc}
		run={props.run}
		reader={reader}
		selectSourceFiles={selectSourceFiles}
		formatPath={formatPath}
		navigation={navigation}
		trace={props.trace}
		children={props.children}
		className={props.className} />
}

export function getLogicalLocationText(location: Location | undefined): string | undefined {
	const logicalLocation = location?.logicalLocations?.[0]
	return logicalLocation?.fullyQualifiedName ?? logicalLocation?.decoratedName ?? logicalLocation?.name
}
