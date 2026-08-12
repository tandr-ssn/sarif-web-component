import {render} from '@testing-library/react'
import {renderCell} from './RunCard.renderCell'
import {looksLikeMarkdown} from './ResultFields'

test('attaches the rule description tooltip to the rendered rule title', () => {
	const rule: any = {
		id: 'calgary.path-safety',
		isRule: true,
		fullDescription: {text: 'Detects unsafe file access.'},
		results: [],
		treeItem: {childItemsAll: []},
		run: {},
	}
	const treeItem: any = {
		depth: 0,
		underlyingItem: {data: rule, expanded: false, childItems: []},
	}
	const {container} = render(renderCell(0, 0, {id: 'Details'} as any, treeItem))

	expect(container.querySelector<HTMLElement>('.swcRuleTitle')?.dataset.swcTooltip).toBe('Detects unsafe file access.')
})

test('preserves line endings in selected result and rule field values', () => {
	const result: any = {
		message: {text: 'Affected dependency'},
		_rule: {help: {text: '\n\nUpgrade Calgary.Package.\nRestart the River service.\nVerify the resolved version.\n\n'}},
	}
	const treeItem: any = {underlyingItem: {data: result}}
	const {container} = render(renderCell(0, 1, {id: 'rule.help.text'} as any, treeItem))
	const value = container.querySelector<HTMLElement>('.swcResultFieldValue')

	expect(value?.style.whiteSpace).toBe('pre-wrap')
	expect(value?.textContent).toBe('Upgrade Calgary.Package.\nRestart the River service.\nVerify the resolved version.')
})

test('detects common Markdown in text fields without treating ordinary prose as Markdown', () => {
	expect(looksLikeMarkdown('rule.help.markdown', 'Ordinary text')).toBe(true)
	expect(looksLikeMarkdown('rule.help.text', '### Remediation\n\nUpgrade the package.')).toBe(true)
	expect(looksLikeMarkdown('rule.help.text', 'Run ```npm update``` to continue.')).toBe(true)
	expect(looksLikeMarkdown('rule.help.text', 'See [the advisory](https://example.test/advisory).')).toBe(true)
	expect(looksLikeMarkdown('rule.help.text', 'Upgrade the package and restart the service.')).toBe(false)
	expect(looksLikeMarkdown('rule.name', '### Not a text field')).toBe(false)
})

test('renders Markdown-looking text fields with safe external links', () => {
	const result: any = {
		message: {text: 'Affected dependency'},
		_rule: {help: {text: '### Remediation\n\nSee [the advisory](https://example.test/advisory).\n\n| Version | Status |\n| --- | --- |\n| 1.0 | affected |'}},
	}
	const treeItem: any = {underlyingItem: {data: result}}
	const {container} = render(renderCell(0, 1, {
		id: 'rule.help.text', copyString: () => result._rule.help.text,
	} as any, treeItem))

	expect(container.querySelector('.swcResultFieldValue.swcMarkDown h3')?.textContent).toBe('Remediation')
	expect(container.querySelector('.swcResultFieldValue a')?.getAttribute('href')).toBe('https://example.test/advisory')
	expect(container.querySelector('.swcResultFieldValue a')?.getAttribute('rel')).toBe('noopener noreferrer')
	expect(container.querySelectorAll('.swcResultFieldValue table')).toHaveLength(1)
	expect(Array.from(container.querySelectorAll('.swcResultFieldValue th')).map(cell => cell.textContent)).toEqual(['Version', 'Status'])
	expect(container.querySelector<HTMLElement>('[data-copy-value]')?.dataset.copyValue).toContain('| --- | --- |')
	expect(container.querySelector<HTMLElement>('[data-copy-markdown-value]')?.dataset.copyMarkdownValue).toContain('| --- | --- |')
})

test('marks an embedded Path as a separate logical clipboard value', () => {
	const result: any = {message: {text: 'Finding'}, _rule: {}, run: {}}
	const treeItem: any = {underlyingItem: {data: result}}
	const {container} = render(renderCell(0, 1, {
		id: 'Details',
		copyString: () => 'Finding',
		embedPath: true,
		embeddedPathCopyString: () => 'calgary/src/River.ts',
	} as any, treeItem))

	const marker = container.querySelector<HTMLElement>('[data-copy-value]')
	expect(marker?.dataset.copyValue).toBe('Finding')
	expect(marker?.dataset.copyLeadingValue).toBe('calgary/src/River.ts')
})

test('resolves numeric message links through SARIF related locations', () => {
	const result: any = {
		message: {text: 'Review [the source](7).'},
		_rule: {},
		relatedLocations: [{
			id: 7,
			physicalLocation: {artifactLocation: {uri: 'src/River.ts'}, region: {startLine: 12}},
		}],
		run: {versionControlProvenance: [{
			repositoryUri: 'https://github.com/edmonton/calgary',
			revisionId: 'abc123',
		}]},
	}
	const treeItem: any = {underlyingItem: {data: result}}
	const {container} = render(renderCell(0, 0, {id: 'Details'} as any, treeItem))

	expect(container.querySelector('a')?.getAttribute('href')).toBe(
		'https://github.com/edmonton/calgary/blob/abc123/src/River.ts#L12',
	)
	expect(container.querySelector('a')?.textContent).toBe('the source')
})
