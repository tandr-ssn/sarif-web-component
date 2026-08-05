import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import * as Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import {Result} from 'sarif'
import {ExecutionTrace} from './ExecutionTrace'
import {SourceLocationLink} from './SourceLocationLink'

Enzyme.configure({ adapter: new Adapter() })

test('renders result stacks and code flows', () => {
	const run: any = {
		threadFlowLocations: [{
			location: {
				message: { text: 'Enter handler' },
				physicalLocation: {
					artifactLocation: { uri: 'src/handler.ts' },
					region: { startLine: 5, snippet: {text: 'handle(request)'} },
				},
			},
		}],
	}
	const result = {
		run,
		message: { text: 'Finding' },
		stacks: [{
			frames: [{
				module: 'app',
				location: {
					logicalLocations: [{ fullyQualifiedName: 'App.Run' }],
					physicalLocation: { artifactLocation: { uri: 'src/app.ts' }, region: { startLine: 10 } },
				},
			}],
		}],
		codeFlows: [{ threadFlows: [{ locations: [{ index: 0 }] }] }],
	} as Result

	const wrapper = mount(<ExecutionTrace result={result} />)
	expect(wrapper.find('summary').map(summary => summary.text())).toEqual([
		'Call stack (1 frames)',
		'Code flow',
	])
	expect(wrapper.text()).toContain('App.Run')
	expect(wrapper.text()).toContain('src/app.ts:10')
	expect(wrapper.text()).toContain('Enter handler')
	expect(wrapper.text()).toContain('src/handler.ts:5')
	expect(wrapper.find('.swcSnippet').text()).toContain('handle(request)')
	const sourceLinks = wrapper.find(SourceLocationLink)
	expect(sourceLinks.at(0).prop('trace')).toEqual({
		locations: [result.stacks[0].frames[0].location.physicalLocation],
		activeIndex: 0,
		label: 'Call stack',
	})
	expect(sourceLinks.at(1).prop('trace')).toEqual({
		locations: [run.threadFlowLocations[0].location.physicalLocation],
		activeIndex: 0,
		label: 'Code flow',
	})
})
