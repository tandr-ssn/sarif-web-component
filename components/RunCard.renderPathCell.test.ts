import { mount, shallow } from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import { renderPathCell } from './RunCard.renderPathCell'
import { demoResults } from './PathCellDemo'
import {Result} from 'sarif'
import {Hi} from './Hi'
import {SourcePathFormatterContext} from './SourceFile'

Enzyme.configure({ adapter: new Adapter() })

test('renders supported path shapes without failing', () => {
	for (const result of demoResults()) {
		expect(() => shallow(renderPathCell(result))).not.toThrow()
	}
})

test('renders an embedded, middle-ellipsized path with its source position', () => {
	const result = {
		message: {text: 'Finding'},
		locations: [{physicalLocation: {
			artifactLocation: {uri: 'src/features/deep/Handler.cs'},
			region: {startLine: 42, startColumn: 7},
		}}],
		run: {},
	} as unknown as Result
	const wrapper = mount(renderPathCell(result, true))

	expect(wrapper.hasClass('swcFindingPath')).toBe(true)
	expect(wrapper.prop('data-swc-tooltip')).toBe('src/features/deep/Handler.cs:42:7')
	const pathText = wrapper.find(Hi).map(part => React.Children.toArray(part.prop('children')).join('')).join('')
	expect(pathText).toBe('src/features/deep/Handler.cs:42:7')
})

test('updates the displayed path when the selected source root changes', () => {
	const result = {
		message: {text: 'Finding'},
		locations: [{physicalLocation: {
			artifactLocation: {uri: '/home/user/calgary/src/Handler.cs'},
			region: {startLine: 42},
		}}],
		run: {},
	} as unknown as Result
	const RootedPath = (props: {root: string}) => React.createElement(SourcePathFormatterContext.Provider, {
		value: () => `${props.root}/${props.root === 'calgary' ? 'src/' : ''}Handler.cs`,
	}, renderPathCell(result, true))
	const wrapper = mount(React.createElement(RootedPath, {root: 'calgary'}))
	const displayedPath = () => wrapper.find(Hi)
		.map(part => React.Children.toArray(part.prop('children')).join('')).join('')

	expect(displayedPath()).toBe('calgary/src/Handler.cs:42')
	wrapper.setProps({root: 'src'})
	expect(displayedPath()).toBe('src/Handler.cs:42')
	expect(wrapper.find('.swcFindingPath').prop('data-swc-tooltip')).toBe('/home/user/calgary/src/Handler.cs:42')
})

test('does not treat an artifact description as a root-relative path', () => {
	const result = {
		message: {text: 'Finding'},
		locations: [{physicalLocation: {
			artifactLocation: {uri: '/home/user/calgary/src/Handler.cs', description: {text: 'Calgary service handler'}},
			region: {startLine: 42},
		}}],
		run: {},
	} as unknown as Result
	const wrapper = mount(React.createElement(SourcePathFormatterContext.Provider, {
		value: () => 'calgary/src/Handler.cs',
	}, renderPathCell(result, true)))
	const displayedPath = wrapper.find(Hi)
		.map(part => React.Children.toArray(part.prop('children')).join('')).join('')

	expect(displayedPath).toBe('Calgary service handler:42')
})
