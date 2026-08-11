import {expect, test} from '@playwright/test'
import * as path from 'node:path'
import {pathToFileURL} from 'node:url'

const docsUrl = pathToFileURL(path.resolve(__dirname, '../docs/index.html')).href
const sessionKey = 'sarif-web-component:docs'
const fitAllColumnsKey = `${sessionKey}:fit-all-columns`

const syntheticSarif = {
	version: '2.1.0',
	runs: [{
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
				artifactLocation: {uri: 'src/Ottawa/River.ts'},
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
	expect(controlsTop).toBeGreaterThanOrEqual(28)
	expect(headerTop).toBeGreaterThan(controlsTop)
	await expect(page.getByRole('button', {name: 'Filter Details'})).toBeVisible()
})
