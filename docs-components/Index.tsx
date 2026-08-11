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
import {docsSessionKey, indexedDbRememberedSarifStore, loadRememberedSarifFromSession, rememberSarif} from './SarifSession'

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

const rememberedSessionSarif = loadRememberedSarifFromSession(window.sessionStorage)

// file is File/Blob
const readAsText = file => new Promise<string>((resolve, reject) => {
	let reader = new FileReader()
	reader.onload = () => resolve(reader.result as any)
	reader.onerror = reject
	reader.readAsText(file)
})

@observer export class Index extends React.Component {
	@observable.ref sample = (() => {
		try { return rememberedSessionSarif ? JSON.parse(rememberedSessionSarif.text) : demoLog }
		catch (_) { return demoLog }
	})()
	@observable currentSarifFileName = rememberedSessionSarif?.name
	private sourcePickerContainer?: HTMLSpanElement
	private sarifFileHandle?: FileSystemFileHandleLike
	private currentSarifFile?: File
	private loadRevision = 0
	private persistence = Promise.resolve()
	state = {sourcePickerReady: false}
	componentDidMount() {
		this.setState({sourcePickerReady: true})
		if (!rememberedSessionSarif) void indexedDbRememberedSarifStore.get().then(remembered => {
			if (!remembered || this.loadRevision !== 0) return
			try {
				this.sample = JSON.parse(remembered.text)
				this.currentSarifFileName = remembered.name
			} catch (_) {
				void indexedDbRememberedSarifStore.remove()
			}
		}).catch(() => undefined)
	}
	@autobind async loadFile(file, handle?: FileSystemFileHandleLike) {
		if (!file) return
		if (!file.name.match(/.(json|sarif)$/i)) {
			alert('File name must end with ".json" or ".sarif"')
			return
		}
		const revision = ++this.loadRevision
		const text = await readAsText(file)
		if (revision !== this.loadRevision) return
		const sample = JSON.parse(text)
		let persistenceError: unknown
		this.persistence = this.persistence.then(async () => {
			if (revision !== this.loadRevision) return
			try {
				await rememberSarif({name: file.name, text}, window.sessionStorage, indexedDbRememberedSarifStore)
			} catch (error) {
				persistenceError = error
			}
		})
		await this.persistence
		if (revision !== this.loadRevision) return
		this.currentSarifFile = file
		this.currentSarifFileName = file.name
		this.sarifFileHandle = handle
		this.sample = sample
		if (persistenceError) {
			alert(`The SARIF file was opened, but could not be remembered for refresh: ${persistenceError instanceof Error ? persistenceError.message : String(persistenceError)}`)
		}
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
				{this.sarifFileHandle && <span data-swc-tooltip="Re-read the current SARIF file from disk.">
					<Button text="Reload" onClick={() => void this.reloadFile()} />
				</span>}
				{this.currentSarifFileName && <span className="demoSarifName" data-swc-tooltip={this.currentSarifFileName}>
					SARIF: <strong>{this.currentSarifFileName}</strong>
				</span>}
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

const app = document.getElementById('app')
if (app) ReactDOM.render(<Index />, app)
