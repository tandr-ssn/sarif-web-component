import {Result} from 'sarif'
import {getRuleTooltip, getTreeRowClass} from './RunCard.rowPresentation'
import {Rule} from './Viewer.Types'

const result = (level?: Result['level'], kind?: Result['kind']) => ({
	message: {text: 'Synthetic finding'}, level, kind,
}) as Result

test('uses the most detailed available rule description in tooltips', () => {
	const rule = {
		isRule: true,
		fullDescription: {text: 'Detects unsafe file access.'},
		shortDescription: {text: 'Unsafe file access'},
	} as Rule

	expect(getRuleTooltip(rule)).toBe('Detects unsafe file access.')
	delete rule.fullDescription
	expect(getRuleTooltip(rule)).toBe('Unsafe file access')
	delete rule.shortDescription
	expect(getRuleTooltip(rule)).toBe('No description was included for this rule.')
})

test.each([
	[result('error', 'fail'), 'swcResultError'],
	[result('warning', 'fail'), 'swcResultWarning'],
	[result('note', 'informational'), 'swcResultNote'],
	[result('none', 'fail'), 'swcResultError'],
	[result('none', 'pass'), 'swcResultSuccess'],
	[result(undefined, 'fail'), 'swcResultWarning'],
])('maps SARIF result semantics to a row tone', (finding, expected) => {
	expect(getTreeRowClass(finding)).toBe(expected)
})

test('tones rule rows without coloring unrelated groups', () => {
	expect(getTreeRowClass({isRule: true})).toBe('swcRuleRow')
	expect(getTreeRowClass({isAge: true})).toBeUndefined()
})
