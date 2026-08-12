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
			fingerprints: {primary: 'synthetic-river-finding'},
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
			fingerprints: {primary: 'synthetic-willow-finding'},
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
	const firstRunCard = page.locator('.bolt-card').first()
	const firstRunHeader = firstRunCard.locator('.bolt-card-header')
	const headerSize = await firstRunHeader.boundingBox()
	if (!headerSize) throw new Error('Run section header is not visible')
	await firstRunHeader.click({position: {x: headerSize.width - 12, y: headerSize.height / 2}})
	await expect(firstRunCard.getByText('Affected Ottawa dependency', {exact: true})).toHaveCount(0)
	await firstRunHeader.click({position: {x: headerSize.width - 12, y: headerSize.height / 2}})
	await expect(firstRunCard.getByText('Affected Ottawa dependency', {exact: true})).toBeVisible()
	const scrollContainers = page.locator('.swcTreeHorizontalScroll')
	const headerScroll = page.locator('.swcGlobalResultHeader .swcTreeHorizontalScroll')
	const resultScroll = page.locator('.bolt-card .swcTreeHorizontalScroll').first()
	await expect(scrollContainers).toHaveCount(2)
	await expect(headerScroll).toHaveCSS('overflow-x', 'scroll')
	await expect.poll(() => headerScroll.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
	await headerScroll.evaluate(element => element.scrollLeft = 120)
	await expect.poll(() => resultScroll.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
	await headerScroll.evaluate(element => element.scrollLeft = element.scrollWidth)
	const stickyVisibility = page.locator('.swcFindingStickyCell').getByRole('button', {name: 'Hide finding', exact: true})
	await expect(stickyVisibility).toBeVisible()
	const stickyGeometry = await stickyVisibility.evaluate(element => {
		const button = element.getBoundingClientRect()
		const cell = element.closest('.swcFindingStickyCell')?.getBoundingClientRect()
		const icon = element.querySelector('svg')?.getBoundingClientRect()
		return {button, cell, icon}
	})
	expect(stickyGeometry.button.right).toBeLessThanOrEqual((await page.viewportSize()).width)
	expect(stickyGeometry.icon.width).toBeGreaterThanOrEqual(20)
	expect(Math.abs(stickyGeometry.button.left + stickyGeometry.button.width / 2
		- (stickyGeometry.cell.left + stickyGeometry.cell.width / 2))).toBeLessThanOrEqual(1)
	const lastSizer = page.locator('.swcGlobalResultHeader .bolt-table-header-sizer').last()
	const lastHeader = lastSizer.locator('xpath=ancestor::th[1]')
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
	const fittedWidths = await page.locator('.swcGlobalResultHeader .bolt-table-header-cell[data-column-index]')
		.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width))
	await page.getByRole('menuitemcheckbox', {name: 'Fit all columns'}).click()
	await expect(page.locator('.swcGlobalResultHeader .bolt-table-header-sizer')).toHaveCount(selectedFields.length - 1)
	const scrollingWidths = await page.locator('.swcGlobalResultHeader .bolt-table-header-cell[data-column-index]')
		.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width))
	expect(scrollingWidths.every((width, index) => Math.abs(width - fittedWidths[index]) <= 1)).toBe(true)
	await page.keyboard.press('Escape')
	await page.getByRole('button', {name: 'Result view options'}).click()
	await page.getByRole('menuitemcheckbox', {name: 'Fit all columns'}).click()

	await page.getByRole('button', {name: 'Filter Details'}).click()
	await page.getByRole('searchbox', {name: 'Filter Details'}).fill('Ottawa')
	await expect(page.getByLabel('Column filter active')).toBeVisible()
	const clearAll = page.getByRole('button', {name: 'Clear filters'})
	await expect(clearAll).toBeEnabled()
	await page.keyboard.press('Escape')

	const keyword = page.getByPlaceholder('Filter by keyword')
	await keyword.fill('River')
	await page.locator('.bolt-text-filterbaritem-clear').click()
	await clearAll.click()
	await expect(page.getByLabel('Column filter active')).toHaveCount(0)
	await expect(clearAll).toBeDisabled()

	await page.getByRole('button', {name: 'Filter Details'}).click()
	await page.getByRole('searchbox', {name: 'Filter Details'}).fill('does-not-match')
	await expect(page.getByText('No matching results')).toBeVisible()
	await expect(page.getByRole('button', {name: 'Filter Details'})).toBeVisible()
	await page.keyboard.press('Escape')
	await clearAll.click()
	await expect(page.getByText('No matching results')).toHaveCount(0)

	await page.locator('.swcFindingTriageContent').first().evaluate(element => (element as HTMLElement).style.minHeight = '900px')
	await page.locator('.swcResultWarning').evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY + 260))
	const stickyPosition = await page.evaluate(() => {
		const controls = document.querySelector('.swcResultsControls')?.getBoundingClientRect()
		const row = document.querySelector('.swcResultWarning')?.getBoundingClientRect()
		const action = document.querySelector('.swcFindingStickyCell button')?.getBoundingClientRect()
		return controls && row && action ? {controlsBottom: controls.bottom, rowBottom: row.bottom, actionTop: action.top, actionBottom: action.bottom} : undefined
	})
	expect(stickyPosition.actionTop).toBeGreaterThanOrEqual(stickyPosition.controlsBottom)
	expect(stickyPosition.actionBottom).toBeLessThanOrEqual(stickyPosition.rowBottom)

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

test('persists hidden findings and restores the current SARIF state', async ({page}) => {
	const finding = page.getByText('Affected Ottawa dependency', {exact: true})
	await expect(finding).toBeVisible()
	await page.getByLabel('Finding visibility').click()
	await page.getByRole('button', {name: 'Clear', exact: true}).click()
	await expect(page.getByLabel('Finding visibility')).toContainText('Visibility: none')
	await expect(finding).toHaveCount(0)
	await page.getByLabel('Finding visibility').click()
	await page.locator('.bolt-list-box-row').filter({hasText: 'Visible'}).click()
	await page.keyboard.press('Escape')
	await expect(finding).toBeVisible()
	await page.locator('.swcFindingStickyCell').getByRole('button', {name: 'Hide finding', exact: true}).click()
	await expect(finding).toHaveCount(0)
	await expect(page.getByRole('status')).toContainText('Finding hidden')

	await page.reload()
	await expect(finding).toHaveCount(0)
	await page.getByLabel('Finding visibility').click()
	await expect(page.locator('.bolt-list-box-row').filter({hasText: /^Visible \(\d+\)$/})).toBeVisible()
	await expect(page.locator('.bolt-list-box-row').filter({hasText: /^Hidden \(\d+\)$/})).toBeVisible()
	await page.locator('.bolt-list-box-row').filter({hasText: 'Hidden'}).click()
	await page.keyboard.press('Escape')
	await expect(page.getByLabel('Finding visibility')).toContainText('Visibility: All')
	await expect(finding).toBeVisible()
	await page.getByLabel('Finding visibility').click()
	await page.locator('.bolt-list-box-row').filter({hasText: 'Visible'}).click()
	await page.keyboard.press('Escape')
	await expect(page.getByLabel('Finding visibility')).toContainText('Visibility: Hidden')
	await page.locator('.swcFindingStickyCell').getByRole('button', {name: 'Unhide finding', exact: true}).click()
	await expect(finding).toHaveCount(0)
	await page.getByLabel('Finding visibility').click()
	await page.locator('.bolt-list-box-row').filter({hasText: 'Hidden'}).click()
	await page.locator('.bolt-list-box-row').filter({hasText: 'Visible'}).click()
	await page.keyboard.press('Escape')
	await expect(finding).toBeVisible()

	await page.locator('.swcFindingStickyCell').getByRole('button', {name: 'Hide finding', exact: true}).click()
	await page.getByRole('button', {name: 'Result view options'}).click()
	await page.getByRole('menuitem', {name: 'Restore all findings in this SARIF'}).click()
	await expect(finding).toBeVisible()
})

test('keeps search and actions usable in a narrow side-by-side window', async ({page}) => {
	await page.setViewportSize({width: 560, height: 800})
	const toolbar = page.locator('.swcFilterToolbar')
	const search = page.locator('.swcKeywordFilter')
	const actions = page.locator('.swcFilterToolbarActions')
	const geometry = await Promise.all([toolbar, search, actions].map(locator => locator.evaluate(element => {
		const box = element.getBoundingClientRect()
		return {left: box.left, right: box.right, top: box.top, bottom: box.bottom}
	})))
	const [toolbarBox, searchBox, actionsBox] = geometry
	expect(searchBox.left).toBeGreaterThanOrEqual(toolbarBox.left)
	expect(searchBox.right).toBeLessThanOrEqual(toolbarBox.right + 1)
	expect(actionsBox.right).toBeLessThanOrEqual(toolbarBox.right + 1)
	expect(actionsBox.top).toBeGreaterThanOrEqual(searchBox.bottom - 1)
	await expect(page.getByRole('button', {name: /Fields/})).toBeVisible()
	await expect(page.getByRole('button', {name: /Export/})).toBeVisible()
	await expect(page.getByRole('button', {name: 'Result view options'})).toBeVisible()
})

test('uses a full-width relative path and matching controls in the source popup', async ({page}) => {
	const [popup] = await Promise.all([
		page.waitForEvent('popup'),
		page.locator('.swcFindingPath a').first().click(),
	])
	await expect(popup.locator('[data-current-file]')).toHaveText('src/Ottawa/River.ts:42:9')
	await expect(popup).toHaveTitle('River.ts — Synthetic river advisory')
	await expect(popup.getByRole('button', {name: /Findings/})).toBeVisible()
	await expect(popup.getByLabel('Finding in this file')).toHaveValue(/.+/)
	await expect(popup.locator('.finding-navigation')).not.toHaveText(/^\s*Finding\b/)
	await expect(popup.locator('.line-number .finding-marker').first()).toBeVisible()
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
			buttonFontWeight: buttonStyle?.fontWeight,
			pathFontWeight: path && getComputedStyle(path).fontWeight,
		}
	})
	expect(presentation.pathAboveControls).toBe(true)
	expect(presentation.bodyFontSize).toBe('14px')
	expect(presentation.buttonFontSize).toBe('14px')
	expect(presentation.buttonFontFamily).toBe(presentation.bodyFontFamily)
	expect(presentation.buttonFontWeight).toBe('400')
	expect(presentation.pathFontWeight).toBe('400')
	await Promise.all([
		popup.waitForEvent('close'),
		popup.getByRole('button', {name: /Findings/}).click(),
	])
})
