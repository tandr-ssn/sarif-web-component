// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './ResultFieldSelector.scss'
import * as React from 'react'
import {IObservableValue, observable} from 'mobx'
import {observer} from 'mobx-react'
import {buildResultFieldTree, BUILT_IN_RESULT_FIELDS, ResultFieldNode} from './ResultFields'
import {Callout} from 'azure-devops-ui/Callout'
import {Location} from 'azure-devops-ui/Utilities/Position'

function leafPaths(node: ResultFieldNode): string[] {
	return [...(node.path ? [node.path] : []), ...node.children.flatMap(leafPaths)]
}

function includesSearch(node: ResultFieldNode, search: string): boolean {
	return !search || node.path?.toLowerCase().includes(search) || node.children.some(child => includesSearch(child, search))
}

@observer
class FieldTreeNode extends React.Component<{
	node: ResultFieldNode
	selected: IObservableValue<string[]>
	search: string
}> {
	private setChecked = (element: HTMLInputElement | null) => {
		if (!element) return
		const paths = leafPaths(this.props.node)
		const count = paths.filter(path => this.props.selected.get().includes(path)).length
		element.indeterminate = count > 0 && count < paths.length
	}

	private toggle = (checked: boolean) => {
		const paths = leafPaths(this.props.node)
		const current = this.props.selected.get()
		const next = checked
			? [...current, ...paths.filter(path => !current.includes(path))]
			: current.filter(path => !paths.includes(path))
		this.props.selected.set(next.length ? next : ['Path'])
	}

	render() {
		const {node, selected, search} = this.props
		if (!includesSearch(node, search)) return null
		const paths = leafPaths(node)
		const checkedCount = paths.filter(path => selected.get().includes(path)).length
		const label = <label title={node.path} onClick={event => event.stopPropagation()}>
			<input type="checkbox" checked={checkedCount === paths.length} ref={this.setChecked}
				onClick={event => event.stopPropagation()}
				onChange={event => this.toggle(event.currentTarget.checked)} />
			{node.displayName ?? node.name}
		</label>
		return <li>
			{node.children.length
				? <details open={!!search}><summary>{label}</summary>
					<ul>{node.children.map(child => <FieldTreeNode key={child.name} node={child} selected={selected} search={search} />)}</ul>
				</details>
				: label}
		</li>
	}
}

@observer
export class ResultFieldSelector extends React.Component<{
	fieldPaths: string[]
	selected: IObservableValue<string[]>
}> {
	@observable private search = ''
	@observable private open = false
	private anchor?: HTMLButtonElement

	render() {
		const builtIns = Array.from(BUILT_IN_RESULT_FIELDS).filter(field => this.props.fieldPaths.includes(field))
		const dynamic = this.props.fieldPaths.filter(field => !BUILT_IN_RESULT_FIELDS.has(field))
		const tree = [
			...builtIns.map(name => ({name, path: name, children: []})),
			...buildResultFieldTree(dynamic),
		]
		const search = this.search.trim().toLowerCase()
		return <div className="swcResultFieldSelector">
			<button type="button" ref={element => this.anchor = element ?? undefined}
				title="Choose which SARIF result fields are shown as columns"
				aria-expanded={this.open}
				onClick={() => this.open = !this.open}>Fields ({this.props.selected.get().length}) <span aria-hidden="true">{this.open ? '▴' : '▾'}</span></button>
			{this.open && this.anchor && <Callout
				anchorElement={this.anchor}
				anchorOrigin={{horizontal: Location.start, vertical: Location.end}}
				calloutOrigin={{horizontal: Location.start, vertical: Location.start}}
				blurDismiss={false}
				escDismiss={true}
				lightDismiss={true}
				onDismiss={() => this.open = false}>
				<div className="swcResultFieldMenu"
					onClick={event => event.stopPropagation()}
					onMouseDown={event => event.stopPropagation()}>
				<input type="search" aria-label="Search result fields" placeholder="Search fields" value={this.search}
					onChange={event => this.search = event.currentTarget.value} />
				<ul>{tree.map(node => <FieldTreeNode key={node.name} node={node} selected={this.props.selected} search={search} />)}</ul>
				</div>
			</Callout>}
		</div>
	}
}
