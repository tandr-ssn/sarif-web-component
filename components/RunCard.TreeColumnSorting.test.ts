import {SortOrder} from 'azure-devops-ui/Table'
import {TreeColumnSorting} from './RunCard.TreeColumnSorting'

test('uses updated columns when fields are added', () => {
	const onSort = jest.fn()
	const listeners = {} as Record<string, (event: any) => void>
	const eventDispatch = {
		addEventListener: (name: string, listener: (event: any) => void) => listeners[name] = listener,
		removeEventListener: jest.fn(),
	} as any
	const behavior = new TreeColumnSorting(onSort)
	const initialProps = {columns: [{id: 'Path', sortProps: {}}]} as any
	const updatedProps = {columns: [
		{id: 'Path', sortProps: {}},
		{id: 'ruleId', sortProps: {}},
	]} as any

	behavior.initialize(initialProps, {} as any, eventDispatch)
	behavior.componentDidUpdate(updatedProps)

	const row = document.createElement('tr')
	row.setAttribute('data-row-index', '-1')
	const cell = document.createElement('th')
	cell.setAttribute('data-column-index', '1')
	const title = document.createElement('span')
	cell.appendChild(title)
	row.appendChild(cell)
	const event = {target: title, defaultPrevented: false, preventDefault: jest.fn()}

	listeners.click(event)

	expect(onSort).toHaveBeenCalledWith(1, SortOrder.ascending, event)
	expect(event.preventDefault).toHaveBeenCalled()
})
