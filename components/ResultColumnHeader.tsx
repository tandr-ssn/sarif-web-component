// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './ResultColumnHeader.scss'
import * as React from 'react'
import {observable} from 'mobx'
import {observer} from 'mobx-react'
import {Callout} from 'azure-devops-ui/Callout'
import {ITableColumn, TableHeaderCell} from 'azure-devops-ui/Table'
import {Location} from 'azure-devops-ui/Utilities/Position'
import {ResultOrRuleOrMore} from './Viewer.Types'
import {RunStore, resultColumnFilterKey} from './RunStore'
import {ITreeItemEx} from 'azure-devops-ui/Utilities/TreeItemProvider'
import {BUILT_IN_RESULT_FIELDS, getResultFieldJsonPath} from './ResultFields'

const VALUE_FILTER_LIMIT = 12

@observer
export class ResultColumnHeader extends React.Component<{
	columnIndex: number
	column: ITableColumn<ITreeItemEx<ResultOrRuleOrMore>>
	runStore: RunStore
	focuszoneId?: string
	isFirstActionableHeader?: boolean
}> {
	@observable private open = false
	private anchor?: HTMLButtonElement

	private setValue(value: string | string[] | undefined) {
		const {filter} = this.props.runStore
		const key = resultColumnFilterKey(this.props.column.id)
		if (value === undefined || value === '' || Array.isArray(value) && !value.length) filter.resetFilterItemState(key)
		else filter.setFilterItemState(key, {value})
	}

	private stop = (event: React.SyntheticEvent) => event.stopPropagation()

	render() {
		const {columnIndex, column, runStore, focuszoneId, isFirstActionableHeader} = this.props
		const key = resultColumnFilterKey(column.id)
		const value = runStore.filter.getFilterItemValue<string | string[]>(key)
		const options = runStore.columnFilterOptions(column.id)
		const useValues = !['Path', 'Details'].includes(column.id) && options.length > 0 && options.length <= VALUE_FILTER_LIMIT
		const active = typeof value === 'string' ? !!value.trim() : !!value?.length
		const fieldPath = getResultFieldJsonPath(column.id)
		const fieldTooltip = BUILT_IN_RESULT_FIELDS.has(column.id) ? column.id : `SARIF JSON path: ${fieldPath}`
		return <TableHeaderCell column={column} columnIndex={columnIndex} focuszoneId={focuszoneId} isFirstActionableHeader={isFirstActionableHeader}>
			<div className="swcColumnHeader">
				<span className="text-ellipsis" data-swc-tooltip={fieldTooltip}>{column.name}</span>
				<button type="button" className={active ? 'active' : ''} aria-label={`Filter ${column.name}`}
					aria-expanded={this.open} aria-haspopup="menu" data-swc-tooltip={`Filter ${fieldPath}`}
					ref={element => this.anchor = element ?? undefined}
					onMouseDown={this.stop} onClick={event => { this.stop(event); this.open = !this.open }}>⋮</button>
			</div>
			{this.open && this.anchor && <Callout anchorElement={this.anchor}
				anchorOrigin={{horizontal: Location.end, vertical: Location.end}}
				calloutOrigin={{horizontal: Location.end, vertical: Location.start}}
				blurDismiss={false} escDismiss={true} lightDismiss={true}
				onDismiss={() => this.open = false}>
				<div className="swcColumnFilter" onClick={this.stop} onMouseDown={this.stop}>
					<strong>Filter {column.name}</strong>
					{useValues
						? <div className="swcColumnFilterValues">{options.map(option => <label key={option} data-swc-tooltip={option}>
							<input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={event => {
								const current = Array.isArray(value) ? value : []
								this.setValue(event.currentTarget.checked ? [...current, option] : current.filter(item => item !== option))
							}} />
							<span>{option}</span>
						</label>)}</div>
						: <input type="search" aria-label={`Filter ${column.name}`} placeholder="Contains..."
							value={typeof value === 'string' ? value : ''} onChange={event => this.setValue(event.currentTarget.value)} />}
					{active && <button type="button" onClick={() => this.setValue(undefined)}>Clear filter</button>}
				</div>
			</Callout>}
		</TableHeaderCell>
	}
}
