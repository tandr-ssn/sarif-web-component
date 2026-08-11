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
})

test('fits columns, exposes horizontal scrolling, and clears filters deliberately', async ({page}) => {
	const scrollContainer = page.locator('.swcTreeHorizontalScroll')
	await expect(scrollContainer).toBeVisible()
	await expect.poll(() => scrollContainer.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)

	await page.getByRole('button', {name: 'Result view options'}).click()
	const fitAll = page.getByRole('menuitemcheckbox', {name: 'Fit all columns'})
	await expect(fitAll).not.toBeChecked()
	await fitAll.click()
	await expect(scrollContainer).toHaveCount(0)
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
})
