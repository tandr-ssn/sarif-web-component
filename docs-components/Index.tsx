import "./Index.scss"
import autobind from 'autobind-decorator'
import {observable} from "mobx"
import {observer} from "mobx-react"
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { Log } from 'sarif'
import {Button} from 'azure-devops-ui/Button'

import { Viewer } from '../components/Viewer'
import {FileSystemFileHandleLike} from '../components/LocalSourceFile'
import Shield from './Shield'

declare global {
	interface Window {
		showOpenFilePicker?: (options?: {
			multiple?: boolean
			types?: Array<{description?: string, accept: {[mimeType: string]: string[]}}>
		}) => Promise<FileSystemFileHandleLike[]>
	}
}

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
	private sarifFileHandle?: FileSystemFileHandleLike
	private currentSarifFile?: File
	state = {sourcePickerReady: false}
	componentDidMount() {
		this.setState({sourcePickerReady: true})
	}
	@autobind async loadFile(file, handle?: FileSystemFileHandleLike) {
		if (!file) return
		if (!file.name.match(/.(json|sarif)$/i)) {
			alert('File name must end with ".json" or ".sarif"')
			return
		}
		this.currentSarifFile = file
		this.sarifFileHandle = handle
		const text = await readAsText(file)
		this.sample = JSON.parse(text)
		try {
			window.sessionStorage.setItem(sarifSessionKey, text)
		} catch (_) { }
	}
	private openInputFilePicker = () => (this.refs.inputFile as any).click()
	private openFile = async () => {
		if (!window.showOpenFilePicker) {
			this.openInputFilePicker()
			return
		}
		try {
			const [handle] = await window.showOpenFilePicker({
				multiple: false,
				types: [{
					description: 'SARIF files',
					accept: {'application/json': ['.sarif', '.json']},
				}],
			})
			if (handle) await this.loadFile(await handle.getFile(), handle)
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return
			alert(`Unable to open SARIF file: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
	private reloadFile = async () => {
		if (this.sarifFileHandle) {
			try {
				const file = await this.sarifFileHandle.getFile()
				await this.loadFile(file, this.sarifFileHandle)
				return
			} catch (error) {
				alert(`Unable to reload SARIF file: ${error instanceof Error ? error.message : String(error)}`)
				return
			}
		}
		// Standard File objects are immutable snapshots and cannot be refreshed from their original path.
		// Resetting the input after every selection makes choosing the same file fire onChange again.
		this.openInputFilePicker()
	}
	render() {
		return <>
			<div className="demoHeader">
				<span>SARIF Viewer</span>
				<input ref="inputFile" type="file" multiple={false} accept=".sarif,.json" style={{ display: 'none' }}
					onChange={async e => {
						e.persist()
						const input = e.currentTarget
						await this.loadFile(Array.from(input.files)[0])
						input.value = ''
					}} />
				<Button className="demoOpen" text="Open..." onClick={() => void this.openFile()} />
				<Button text="Reload" tooltipProps={{text: this.currentSarifFile
					? 'Re-read the current SARIF file from disk.'
					: 'Select the SARIF file again to reload it from disk.'}}
					onClick={() => void this.reloadFile()} />
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
