import {mount} from 'enzyme'
import * as Enzyme from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import * as React from 'react'
import {act} from 'react-dom/test-utils'
import {Dialog} from 'azure-devops-ui/Dialog'
import {SourceFileSelectionContext} from './SourceFile'
import {SourceLocationLink} from './SourceLocationLink'

Enzyme.configure({ adapter: new Adapter() })

test('explains local folder access before asking for a source folder', () => {
	const selectSourceFiles = jest.fn()
	const run: any = {}
	const ploc: any = { artifactLocation: { uri: 'src/file.ts' } }
	const wrapper = mount(
		<SourceFileSelectionContext.Provider value={selectSourceFiles}>
			<SourceLocationLink ploc={ploc} run={run} />
		</SourceFileSelectionContext.Provider>,
	)

	wrapper.find('a').simulate('click')
	expect(selectSourceFiles).not.toHaveBeenCalled()
	expect(wrapper.find(Dialog).text()).toContain('Files stay on your computer and are not uploaded')
	const chooseButton = wrapper.find(Dialog).prop('footerButtonProps')[0]
	act(() => chooseButton.onClick({} as any))
	expect(selectSourceFiles).toHaveBeenCalledTimes(1)
})
