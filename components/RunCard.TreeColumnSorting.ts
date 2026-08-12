// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {cellFromEvent, IBehavior, IEventDispatch, ITreeProps, ITree, Tree, KeyCode, sortDelegate, SortOrder} from './AzureDevOpsUi'

// Derived from azure-devops-ui ColumnSorting.ts
export class TreeColumnSorting<T> implements IBehavior<ITreeProps<T>, ITree<T>> {
	private onSort: sortDelegate
	private props: Readonly<ITreeProps<T>>
	private eventDispatch?: IEventDispatch

	constructor(onSort: sortDelegate) {
		this.onSort = onSort
	}

	public initialize = (props: Readonly<ITreeProps<T>>, table: Tree<T>, eventDispatch: IEventDispatch): void => {
		this.props = props
		this.eventDispatch = eventDispatch

		eventDispatch.addEventListener("click", this.onClick)
		eventDispatch.addEventListener("keydown", this.onKeyDown)
	}

	public componentDidMount = (props: Readonly<ITreeProps<T>>): void => {
		this.props = props
	}

	public componentDidUpdate = (props: Readonly<ITreeProps<T>>): void => {
		this.props = props
	}

	public componentWillUnmount = (): void => {
		this.eventDispatch?.removeEventListener("click", this.onClick)
		this.eventDispatch?.removeEventListener("keydown", this.onKeyDown)
	}

	private onClick = (event: React.MouseEvent<HTMLElement>) => {
		if (!event.defaultPrevented) {
			this.processSortEvent(event)
		}
	}

	private onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
		if (!event.defaultPrevented) {
			if (event.which === KeyCode.enter || event.which === KeyCode.space) {
				this.processSortEvent(event)
			}
		}
	}

	private processSortEvent(event: React.KeyboardEvent<HTMLElement> | React.MouseEvent<HTMLElement>) {
		const clickedCell = cellFromEvent(event)

		if (clickedCell.rowIndex === -1) {
			const column = this.props.columns[clickedCell.cellIndex]

			// If the column is currently sorted ascending then we need to invert the sort.
			if (column && column.sortProps) {
				this.onSort(
					clickedCell.cellIndex,
					column.sortProps.sortOrder === SortOrder.ascending ? SortOrder.descending : SortOrder.ascending,
					event
				)
				event.preventDefault()
			}
		}
	}
}
