import {expect, test} from '@playwright/test'
import * as path from 'node:path'
import {pathToFileURL} from 'node:url'

const docsUrl = pathToFileURL(path.resolve(__dirname, '../docs/index.html')).href
const sessionKey = 'sarif-web-component:docs'
const fitAllColumnsKey = `${sessionKey}:fit-all-columns`

const syntheticSarif = {
	version: '2.1.0',
	runs: [{
		artifacts: [{
			location: {uri: 'src/Ottawa/River.ts'},
			contents: {text: Array.from({length: 45}, (_, index) => `const riverValue${index + 1} = ${index + 1};`).join('\n')},
		}],
		tool: {driver: {
			name: 'River',
			rules: [{
				id: 'river-1',
				shortDescription: {text: 'Synthetic river advisory'},
				help: {markdown: '### Remediation\n\nUpgrade **Ottawa.Package** and review the advisory.'},
			}],
		}},
		results: [{
			ruleId: 'river-1',
			level: 'warning',
			kind: 'fail',
			message: {text: 'Affected Ottawa dependency'},
			locations: [{physicalLocation: {
				artifactLocation: {uri: 'src/Ottawa/River.ts', index: 0},
				region: {startLine: 42, startColumn: 9},
			}}],
			properties: {
				packageName: 'Ottawa.Package',
				packageVersion: '3.1.4',
				owner: 'River Team',
				advisoryId: 'RIVER-2026-1',
			},
		}],
	}, {
		tool: {driver: {
			name: 'Willow',
			rules: [{id: 'willow-1', shortDescription: {text: 'Synthetic willow advisory'}}],
		}},
		results: [{
			ruleId: 'willow-1',
			level: 'note',
			kind: 'review',
			message: {text: 'Affected Calgary dependency'},
			locations: [{physicalLocation: {artifactLocation: {uri: 'src/Calgary/Willow.ts'}}}],
			properties: {packageName: 'Calgary.Package', packageVersion: '2.0.0'},
		}],
	}],
}

const selectedFields = [
	'Path',
	'Details',
	'Level',
	'Kind',
	'rule.shortDescription.text',
	'rule.help.markdown',
	'result.properties.packageName',
	'result.properties.packageVersion',
	'result.properties.owner',
	'result.properties.advisoryId',
]

test.beforeEach(async ({page}) => {
	await page.addInitScript(({fitKey, fields, sarif, storageKey}) => {
		sessionStorage.setItem(`${storageKey}:sarif:name`, 'Ottawa.sarif')
		sessionStorage.setItem(`${storageKey}:sarif`, JSON.stringify(sarif))
		localStorage.setItem(`${storageKey}:selected-result-fields`, JSON.stringify(fields))
		if (localStorage.getItem(fitKey) === null) localStorage.setItem(fitKey, 'false')
	}, {fitKey: fitAllColumnsKey, fields: selectedFields, sarif: syntheticSarif, storageKey: sessionKey})
	await page.goto(docsUrl)
	await expect(page.getByText('Ottawa.Package', {exact: true}).first()).toBeVisible()
	await expect(page.getByRole('button', {name: 'Filter Details'})).toHaveCount(1)
	const sourceToFilterGap = await page.evaluate(() => {
		const source = document.querySelector('.swcLocalSourceHeader')?.getBoundingClientRect()
		const filter = document.querySelector('.swcFilterToolbar')?.getBoundingClientRect()
		return source && filter ? filter.top - source.bottom : undefined
	})
	expect(sourceToFilterGap).toBeLessThanOrEqual(20)
})

test('fits columns, exposes horizontal scrolling, and clears filters deliberately', async ({page}) => {
	const scrollContainers = page.locator('.swcTreeHorizontalScroll')
	const headerScroll = page.locator('.swcGlobalResultHeader .swcTreeHorizontalScroll')
	const resultScroll = page.locator('.bolt-card .swcTreeHorizontalScroll').first()
	await expect(scrollContainers).toHaveCount(2)
	await expect(headerScroll).toHaveCSS('overflow-x', 'scroll')
	await expect.poll(() => headerScroll.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
	await headerScroll.evaluate(element => element.scrollLeft = 120)
	await expect.poll(() => resultScroll.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
	await headerScroll.evaluate(element => element.scrollLeft = element.scrollWidth)
	const lastHeader = page.locator('.swcGlobalResultHeader .bolt-table-header-cell[data-column-index]').last()
	const lastSizer = lastHeader.locator('.bolt-table-header-sizer')
	const initialLastWidth = await lastHeader.evaluate(element => element.getBoundingClientRect().width)
	await lastSizer.focus()
	for (let index = 0; index < 30; index++) await page.keyboard.press('ArrowRight')
	const expandedLastWidth = await lastHeader.evaluate(element => element.getBoundingClientRect().width)
	for (let index = 0; index < 45; index++) await page.keyboard.press('ArrowLeft')
	const contractedLastWidth = await lastHeader.evaluate(element => element.getBoundingClientRect().width)
	expect(expandedLastWidth).toBeGreaterThan(initialLastWidth)
	expect(contractedLastWidth).toBeLessThan(expandedLastWidth)

	await page.getByRole('button', {name: 'Result view options'}).click()
	const fitAll = page.getByRole('menuitemcheckbox', {name: 'Fit all columns'})
	await expect(fitAll).not.toBeChecked()
	await fitAll.click()
	await expect(scrollContainers).toHaveCount(0)
	await expect.poll(() => page.evaluate(key => localStorage.getItem(key), fitAllColumnsKey)).toBe('true')
	const alignment = await page.evaluate(() => {
		const boxes = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector))
			.map(element => element.getBoundingClientRect())
		const headers = boxes('.swcGlobalResultHeader .bolt-table-header-cell[data-column-index]')
		const headerContents = boxes('.swcGlobalResultHeader .bolt-table-header-cell-content')
		const resultCells = boxes('.swcResultWarning .bolt-table-cell:not(.bolt-table-cell-compact)')
		return {
			verticalOffsets: headers.map((header, index) => Math.abs(
				header.top + header.height / 2 - (headerContents[index].top + headerContents[index].height / 2))),
			columnOffsets: headers.map((header, index) => Math.max(
				Math.abs(header.left - resultCells[index].left),
				Math.abs(header.right - resultCells[index].right))),
		}
	})
	expect(Math.max(...alignment.verticalOffsets)).toBeLessThanOrEqual(0.5)
	expect(Math.max(...alignment.columnOffsets)).toBeLessThanOrEqual(1)
	const headerBorders = await page.locator('.swcGlobalResultHeader').evaluate(element => {
		const style = getComputedStyle(element)
		return {top: style.borderTop, bottom: style.borderBottom}
	})
	expect(headerBorders.top).toBe(headerBorders.bottom)

	await page.reload()
	await expect(page.getByText('Ottawa.Package', {exact: true}).first()).toBeVisible()
	await expect(page.locator('.swcTreeHorizontalScroll')).toHaveCount(0)
	await page.getByRole('button', {name: 'Result view options'}).click()
	await expect(page.getByRole('menuitemcheckbox', {name: 'Fit all columns'})).toBeChecked()
	await page.keyboard.press('Escape')

	await page.getByRole('button', {name: 'Filter Details'}).click()
	await page.getByRole('searchbox', {name: 'Filter Details'}).fill('Ottawa')
	await expect(page.getByLabel('Column filter active')).toBeVisible()
	const clearAll = page.getByRole('button', {name: 'Clear filters; 1 active'})
	await expect(clearAll).toContainText('Clear filters (1)')
	await expect(clearAll).toHaveAttribute('data-swc-tooltip', /Details: contains “Ottawa”/)
	await page.keyboard.press('Escape')

	const keyword = page.getByPlaceholder('Filter by keyword')
	await keyword.fill('River')
	await expect(page.getByRole('button', {name: 'Clear filters; 2 active'})).toContainText('Clear filters (2)')
	await page.locator('.bolt-text-filterbaritem-clear').click()
	await expect(page.getByRole('button', {name: 'Clear filters; 1 active'})).toBeVisible()

	await page.getByRole('button', {name: 'Clear filters; 1 active'}).click()
	await page.getByRole('menuitem', {name: 'Clear all filters'}).click()
	await expect(page.getByLabel('Column filter active')).toHaveCount(0)
	await expect(page.getByText(/^Clear filters \(/)).toHaveCount(0)

	await page.getByRole('button', {name: 'Filter Details'}).click()
	await page.getByRole('searchbox', {name: 'Filter Details'}).fill('does-not-match')
	await expect(page.getByText('No matching results')).toBeVisible()
	await expect(page.getByRole('button', {name: 'Filter Details'})).toBeVisible()
	await page.keyboard.press('Escape')
	await page.getByRole('button', {name: 'Clear filters; 1 active'}).click()
	await page.getByRole('menuitem', {name: /Clear filter: Details/}).click()
	await expect(page.getByText('No matching results')).toHaveCount(0)

	await page.evaluate(() => {
		const spacer = document.createElement('div')
		spacer.style.height = '1200px'
		document.querySelector('.bolt-page')?.appendChild(spacer)
		window.scrollTo(0, document.body.scrollHeight)
	})
	const controlsTop = await page.locator('.swcResultsControls').evaluate(element => element.getBoundingClientRect().top)
	const headerTop = await page.locator('.swcGlobalResultHeader').evaluate(element => element.getBoundingClientRect().top)
	expect(controlsTop).toBeGreaterThanOrEqual(0)
	expect(headerTop).toBeGreaterThan(controlsTop)
	await expect(page.getByRole('button', {name: 'Filter Details'})).toBeVisible()
})

test('uses a full-width relative path and matching controls in the source popup', async ({page}) => {
	const [popup] = await Promise.all([
		page.waitForEvent('popup'),
		page.locator('.swcFindingPath a').first().click(),
	])
	await expect(popup.locator('[data-current-file]')).toHaveText('src/Ottawa/River.ts')
	await expect(popup).toHaveTitle('River.ts')
	const presentation = await popup.evaluate(() => {
		const path = document.querySelector<HTMLElement>('[data-current-file]')
		const row = document.querySelector<HTMLElement>('.source-toolbar-row')
		const button = document.querySelector<HTMLElement>('.source-toolbar button')
		const bodyStyle = getComputedStyle(document.body)
		const buttonStyle = button && getComputedStyle(button)
		return {
			pathAboveControls: !!path && !!row && path.getBoundingClientRect().bottom <= row.getBoundingClientRect().top,
			bodyFontSize: bodyStyle.fontSize,
			buttonFontFamily: buttonStyle?.fontFamily,
			bodyFontFamily: bodyStyle.fontFamily,
			buttonFontSize: buttonStyle?.fontSize,
		}
	})
	expect(presentation.pathAboveControls).toBe(true)
	expect(presentation.bodyFontSize).toBe('14px')
	expect(presentation.buttonFontSize).toBe('14px')
	expect(presentation.buttonFontFamily).toBe(presentation.bodyFontFamily)
})
