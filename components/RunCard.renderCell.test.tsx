import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import {renderCell} from './RunCard.renderCell'

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
