import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {renderCell} from './RunCard.renderCell'
import {looksLikeMarkdown} from './ResultFields'

Enzyme.configure({adapter: new Adapter()})

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
	const wrapper = mount(renderCell(0, 0, {id: 'Details'} as any, treeItem))

	expect(wrapper.find('.swcRuleTitle').prop('data-swc-tooltip')).toBe('Detects unsafe file access.')
})

test('preserves line endings in selected result and rule field values', () => {
	const result: any = {
		message: {text: 'Affected dependency'},
		_rule: {help: {text: '\n\nUpgrade Calgary.Package.\nRestart the River service.\nVerify the resolved version.\n\n'}},
	}
	const treeItem: any = {underlyingItem: {data: result}}
	const wrapper = mount(renderCell(0, 1, {id: 'rule.help.text'} as any, treeItem))
	const value = wrapper.find('.swcResultFieldValue')

	expect(value.prop('style')).toEqual({whiteSpace: 'pre-wrap'})
	expect(value.text()).toBe('Upgrade Calgary.Package.\nRestart the River service.\nVerify the resolved version.')
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
	const wrapper = mount(renderCell(0, 1, {id: 'rule.help.text'} as any, treeItem))

	expect(wrapper.find('.swcResultFieldValue.swcMarkDown h3').text()).toBe('Remediation')
	expect(wrapper.find('.swcResultFieldValue a').prop('href')).toBe('https://example.test/advisory')
	expect(wrapper.find('.swcResultFieldValue a').prop('rel')).toBe('noopener noreferrer')
	expect(wrapper.find('.swcResultFieldValue table')).toHaveLength(1)
	expect(wrapper.find('.swcResultFieldValue th').map(cell => cell.text())).toEqual(['Version', 'Status'])
})
