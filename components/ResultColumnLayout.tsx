import * as React from 'react'
import {IObservableValue} from 'mobx'
import {ObservableValue} from './AzureDevOpsUi'

export function preferredResultColumnWidth(width: number): number {
	return width < 0 ? Math.max(140, Math.abs(width) * 100) : width
}

/** Shared widths and horizontal scroll position for the global header and all result tables. */
export class ResultColumnLayout {
	private widths = new Map<string, ObservableValue<number>>()
	private preferredWidths = new Map<string, number>()
	private scrollElements = new Set<HTMLElement>()
	private synchronizingScroll = false
	private fitHeader?: {element: HTMLElement, ids: string[]}

	constructor(readonly fitAllColumns: IObservableValue<boolean>) { }

	width(id: string, sourceWidth: number): ObservableValue<number> {
		if (!this.preferredWidths.has(id)) this.preferredWidths.set(id, preferredResultColumnWidth(sourceWidth))
		let width = this.widths.get(id)
		const desired = this.fitAllColumns.get() ? sourceWidth : this.preferredWidths.get(id)
		if (!width) {
			width = new ObservableValue(desired)
			this.widths.set(id, width)
		} else if (width.value !== desired) {
			width.value = desired
		}
		return width
	}

	resize(id: string, width: number) {
		this.preferredWidths.set(id, width)
		const observableWidth = this.widths.get(id)
		if (observableWidth) observableWidth.value = width
	}

	registerFitHeader(element: HTMLElement, ids: string[]): () => void {
		const registration = {element, ids}
		this.fitHeader = registration
		return () => {
			if (this.fitHeader === registration) this.fitHeader = undefined
		}
	}

	setFitAll(value: boolean) {
		if (!value && this.fitAllColumns.get()) this.captureRenderedFitWidths()
		this.fitAllColumns.set(value)
	}

	private captureRenderedFitWidths() {
		const registration = this.fitHeader
		if (!registration) return
		registration.element.querySelectorAll<HTMLElement>('.bolt-table-header-cell[data-column-index]').forEach(cell => {
			const id = registration.ids[Number(cell.dataset.columnIndex)]
			const width = cell.getBoundingClientRect().width
			if (id && width > 0) this.preferredWidths.set(id, Math.round(width))
		})
	}

	registerScrollElement(element: HTMLElement): () => void {
		const existing = this.scrollElements.values().next().value as HTMLElement | undefined
		if (existing) element.scrollLeft = existing.scrollLeft
		this.scrollElements.add(element)
		const onScroll = () => {
			if (this.synchronizingScroll) return
			this.synchronizingScroll = true
			this.scrollElements.forEach(candidate => {
				if (candidate !== element) candidate.scrollLeft = element.scrollLeft
			})
			this.synchronizingScroll = false
		}
		element.addEventListener('scroll', onScroll)
		return () => {
			element.removeEventListener('scroll', onScroll)
			this.scrollElements.delete(element)
		}
	}
}

/** Finds the Azure table's scroll element after rendering and joins it to the shared layout. */
export class ResultColumnScroll extends React.Component<{layout: ResultColumnLayout, children: React.ReactNode}> {
	private host?: HTMLDivElement
	private scrollElement?: HTMLElement
	private unregister?: () => void

	componentDidMount() { this.attach() }
	componentDidUpdate() { this.attach() }
	componentWillUnmount() { this.unregister?.() }

	private attach() {
		const scrollElement = this.host?.querySelector<HTMLElement>('.swcTreeHorizontalScroll') ?? undefined
		if (scrollElement === this.scrollElement) return
		this.unregister?.()
		this.scrollElement = scrollElement
		this.unregister = scrollElement ? this.props.layout.registerScrollElement(scrollElement) : undefined
	}

	render() {
		return <div className="swcResultColumnScroll" ref={element => this.host = element ?? undefined}>{this.props.children}</div>
	}
}
