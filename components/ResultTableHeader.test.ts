import {observable} from 'mobx'
import {SortOrder} from 'azure-devops-ui/Table'
import {ResultColumnLayout} from './ResultColumnLayout'
import {setResultColumnSort} from './ResultTableHeader'
import {RunStore} from './RunStore'

test('shares preferred widths across result tables while preserving fit widths', () => {
	const fitAllColumns = observable.box(true)
	const layout = new ResultColumnLayout(fitAllColumns)

	expect(layout.width('Details', -5).value).toBe(-5)
	fitAllColumns.set(false)
	expect(layout.width('Details', -5).value).toBe(500)
	layout.resize('Details', 640)
	expect(layout.width('Details', -5).value).toBe(640)
	fitAllColumns.set(true)
	expect(layout.width('Details', -5).value).toBe(-5)
	fitAllColumns.set(false)
	expect(layout.width('Details', -5).value).toBe(640)
})

test('applies a global column sort to every run', () => {
	const stores = [
		{columns: [{id: 'Path'}, {id: 'Details'}], setColumnSort: jest.fn()},
		{columns: [{id: 'Path'}, {id: 'Details'}], setColumnSort: jest.fn()},
	] as unknown as RunStore[]

	setResultColumnSort(stores, 'Details', SortOrder.descending)

	expect(stores[0].setColumnSort).toHaveBeenCalledWith(1, SortOrder.descending)
	expect(stores[1].setColumnSort).toHaveBeenCalledWith(1, SortOrder.descending)
})
