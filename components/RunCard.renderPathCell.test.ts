import { shallow } from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import { renderPathCell } from './RunCard.renderPathCell'
import { demoResults } from './PathCellDemo'
import {Result} from 'sarif'
import {Hi} from './Hi'

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
	const wrapper = shallow(renderPathCell(result, true))

	expect(wrapper.hasClass('swcFindingPath')).toBe(true)
	expect(wrapper.prop('data-swc-tooltip')).toBe('src/features/deep/Handler.cs:42:7')
	const pathText = wrapper.find(Hi).map(part => React.Children.toArray(part.prop('children')).join('')).join('')
	expect(pathText).toBe('src/features/deep/Handler.cs:42:7')
})
