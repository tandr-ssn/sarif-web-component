import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import * as Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import {SourceFileSelectionContext} from './SourceFile'
import {SourceLocationLink} from './SourceLocationLink'

Enzyme.configure({ adapter: new Adapter() })

test('asks for a source folder when a local file is clicked before selection', () => {
	const selectSourceFiles = jest.fn()
	const run: any = {}
	const ploc: any = { artifactLocation: { uri: 'src/file.ts' } }
	const wrapper = mount(
		<SourceFileSelectionContext.Provider value={selectSourceFiles}>
			<SourceLocationLink ploc={ploc} run={run} />
		</SourceFileSelectionContext.Provider>,
	)

	wrapper.find('a').simulate('click')
	expect(selectSourceFiles).toHaveBeenCalledTimes(1)
})
