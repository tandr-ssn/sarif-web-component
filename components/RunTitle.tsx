// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import {TreeExpand} from 'azure-devops-ui/TreeEx'

export function RunTitle(props: {
	expanded: boolean
	title: string
	onToggle: () => void
	children: React.ReactNode
}) {
	return <span
		className="swcRunTitleToggle"
		data-swc-tooltip={props.title}
		role="button"
		tabIndex={0}
		aria-expanded={props.expanded}
		onClick={props.onToggle}
		onKeyDown={event => {
			if (event.key !== 'Enter' && event.key !== ' ') return
			event.preventDefault()
			props.onToggle()
		}}>
		<TreeExpand
			depth={0}
			expanded={props.expanded}
			onToggle={props.onToggle}
			onClick={event => event.stopPropagation()} />
		{props.children}
	</span>
}
