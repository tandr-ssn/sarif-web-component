import './ResultTableHeader.scss'
import * as React from 'react'
import {observer} from 'mobx-react'
import {SortOrder, Tree, ITreeColumn, TreeItemProvider, ITreeItemEx} from './AzureDevOpsUi'
import {ResultColumnHeader} from './ResultColumnHeader'
import {ResultColumnLayout, ResultColumnScroll} from './ResultColumnLayout'
import {renderCell} from './RunCard.renderCell'
import {TreeColumnSorting} from './RunCard.TreeColumnSorting'
import {RunStore} from './RunStore'
import {ResultOrRuleOrMore} from './Viewer.Types'

export function setResultColumnSort(runStores: RunStore[], columnId: string, sortOrder: SortOrder) {
	runStores.forEach(store => {
		const columnIndex = store.columns.findIndex(column => column.id === columnId)
		if (columnIndex >= 0) store.setColumnSort(columnIndex, sortOrder)
	})
}

@observer export class ResultTableHeader extends React.Component<{
	runStores: RunStore[]
	layout: ResultColumnLayout
}> {
	private host?: HTMLDivElement
	private unregisterFitHeader?: () => void
	private itemProvider = new TreeItemProvider<ResultOrRuleOrMore>([])
	private columnCache = new Map<string, ITreeColumn<ResultOrRuleOrMore>>()
	private currentColumns: ITreeColumn<ResultOrRuleOrMore>[] = []
	private sortingBehavior = new TreeColumnSorting<ITreeItemEx<ResultOrRuleOrMore>>(
		(columnIndex, sortOrder) => {
			const columnId = this.currentColumns[columnIndex]?.id
			if (columnId) setResultColumnSort(this.props.runStores, columnId, sortOrder)
		}
	)

	private getColumns(): ITreeColumn<ResultOrRuleOrMore>[] {
		const {runStores, layout} = this.props
		const first = runStores[0]
		if (!first) return []
		const fitAll = layout.fitAllColumns.get()
		const sortedColumn = first.columns[Math.min(first.sortColumnIndex, first.columns.length - 1)]
		const sharedSort = sortedColumn && runStores.every(store => {
			const column = store.columns[Math.min(store.sortColumnIndex, store.columns.length - 1)]
			return column?.id === sortedColumn.id && store.sortOrder === first.sortOrder
		})
		this.currentColumns = first.displayColumns.map(definition => {
			const {id, name, width} = definition
			if (!this.columnCache.has(id)) {
				this.columnCache.set(id, {
					id,
					name,
					width: layout.width(id, width),
					renderCell,
					renderHeaderCell: (columnIndex, column, focuszoneId, isFirstActionableHeader) =>
						<ResultColumnHeader columnIndex={columnIndex} column={column} runStores={this.props.runStores}
							focuszoneId={focuszoneId} isFirstActionableHeader={isFirstActionableHeader} />,
					sortProps: {ariaLabelAscending: 'Sorted A to Z', ariaLabelDescending: 'Sorted Z to A'},
				} as ITreeColumn<ResultOrRuleOrMore>)
			}
			const column = {
				...this.columnCache.get(id),
				sortProps: {...this.columnCache.get(id).sortProps},
			} as ITreeColumn<ResultOrRuleOrMore>
			this.columnCache.set(id, column)
			column.name = name
			column.width = layout.width(id, width)
			column.onSize = fitAll ? undefined : (event, columnIndex, newWidth) => layout.resize(id, newWidth)
			column.sortProps.sortOrder = sharedSort && sortedColumn.id === id ? first.sortOrder : undefined
			return column
		})
		return this.currentColumns
	}

	componentDidMount() { this.registerFitHeader() }
	componentDidUpdate() { this.registerFitHeader() }
	componentWillUnmount() { this.unregisterFitHeader?.() }

	private registerFitHeader() {
		this.unregisterFitHeader?.()
		this.unregisterFitHeader = this.host
			? this.props.layout.registerFitHeader(this.host, this.currentColumns.map(column => column.id))
			: undefined
	}

	render() {
		const {layout} = this.props
		const fitAll = layout.fitAllColumns.get()
		return <div className="swcGlobalResultHeader" ref={element => this.host = element ?? undefined}>
			<ResultColumnScroll layout={layout}>
				<Tree<ResultOrRuleOrMore> className="swcGlobalResultHeaderTree"
					containerClassName={fitAll ? undefined : 'swcTreeHorizontalScroll'}
					columns={this.getColumns()} itemProvider={this.itemProvider}
					behaviors={[this.sortingBehavior]} showScroll={!fitAll} />
			</ResultColumnScroll>
		</div>
	}
}
