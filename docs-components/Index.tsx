import "./Index.scss"
import autobind from 'autobind-decorator'
import {observable} from "mobx"
import {observer} from "mobx-react"
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { Log } from 'sarif'
import {Button} from 'azure-devops-ui/Button'

import { Viewer } from '../components/Viewer'
import Shield from './Shield'

const demoLog = {
	version: "2.1.0",
	runs: [{
		tool: { driver: {
			name: "Example Tool" },
		},
		results: [
			{
				ruleId: 'Example Rule',
				level: 'error',
				locations: [{
					physicalLocation: { artifactLocation: { uri: 'example.txt' } },
				}],
				message: { text: 'Welcome to the online SARIF Viewer demo. Drag and drop a SARIF file here to view.' },
				baselineState: 'new',
			},
		],
	}]
} as Log

const docsSessionKey = 'sarif-web-component:docs'
const sarifSessionKey = `${docsSessionKey}:sarif`

function loadSessionLog(): Log | undefined {
	try {
		const text = window.sessionStorage.getItem(sarifSessionKey)
		return text ? JSON.parse(text) : undefined
	} catch (_) {
		return undefined
	}
}

// file is File/Blob
const readAsText = file => new Promise<string>((resolve, reject) => {
	let reader = new FileReader()
	reader.onload = () => resolve(reader.result as any)
	reader.onerror = reject
	reader.readAsText(file)
})

@observer export class Index extends React.Component {
	@observable.ref sample = loadSessionLog() ?? demoLog
	private sourcePickerContainer?: HTMLSpanElement
	state = {sourcePickerReady: false}
	componentDidMount() {
		this.setState({sourcePickerReady: true})
	}
	@autobind async loadFile(file) {
		if (!file) return
		if (!file.name.match(/.(json|sarif)$/i)) {
			alert('File name must end with ".json" or ".sarif"')
			return
		}
		const text = await readAsText(file)
		this.sample = JSON.parse(text)
		try {
			window.sessionStorage.setItem(sarifSessionKey, text)
		} catch (_) { }
	}
	render() {
		return <>
			<div className="demoHeader">
				<span>SARIF Viewer</span>
				<input ref="inputFile" type="file" multiple={false} accept="*.sarif" style={{ display: 'none' }}
					onChange={async e => {
						e.persist()
						this.loadFile(Array.from(e.target.files)[0])
					}} />
				<Button className="demoOpen" text="Open..." onClick={() => (this.refs.inputFile as any).click()} />
				<span className="demoSourcePicker" ref={element => this.sourcePickerContainer = element ?? undefined}></span>
				<span style={{ flexGrow: 1 }}></span>
			</div>
			<Viewer logs={[this.sample]} showSuppression showLocalSourcePicker
				localSourcePickerContainer={this.state.sourcePickerReady ? this.sourcePickerContainer : null}
				sessionStorageKey={docsSessionKey}
				filterState={{
					Baseline: { value: ['new', 'unchanged', 'updated'] },
					Suppression: { value: ['unsuppressed']},
				}} />
			<Shield onDrop={this.loadFile} />
		</>
	}
}

ReactDOM.render(<Index />, document.getElementById('app'))
