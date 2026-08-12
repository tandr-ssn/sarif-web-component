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
import {clearRememberedSarifSession, docsSessionKey, indexedDbRememberedSarifStore, loadRememberedSarifFromSession, rememberSarif} from './SarifSession'

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

export function parseSarif(text: string): Log {
	let value: unknown
	try { value = JSON.parse(text) }
	catch (error) { throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`) }
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The document must be a SARIF JSON object.')
	const log = value as Partial<Log>
	if (typeof log.version !== 'string' || !log.version) throw new Error('The SARIF document must specify its version.')
	if (!Array.isArray(log.runs)) throw new Error('The SARIF document must contain a runs array.')
	if (log.runs.some(run => !run?.tool?.driver?.name)) throw new Error('Every SARIF run must identify tool.driver.name.')
	return log as Log
}

@observer export class Index extends React.Component {
	@observable.ref sample = (() => {
		try { return rememberedSessionSarif ? parseSarif(rememberedSessionSarif.text) : demoLog }
		catch (_) { return demoLog }
	})()
	@observable currentSarifFileName = rememberedSessionSarif?.name
	@observable loadError?: string
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
				this.sample = parseSarif(remembered.text)
				this.currentSarifFileName = remembered.name
			} catch (_) {
				void indexedDbRememberedSarifStore.remove()
			}
		}).catch(() => undefined)
	}
	@autobind async loadFile(file, handle?: FileSystemFileHandleLike) {
		if (!file) return
		this.loadError = undefined
		if (!file.name.match(/\.(json|sarif)$/i)) {
			this.loadError = 'File name must end with “.json” or “.sarif”.'
			return
		}
		const revision = ++this.loadRevision
		let text: string
		try { text = await readAsText(file) }
		catch (error) {
			if (revision === this.loadRevision) this.loadError = `Unable to read ${file.name}: ${error instanceof Error ? error.message : String(error)}`
			return
		}
		if (revision !== this.loadRevision) return
		let sample: Log
		try { sample = parseSarif(text) }
		catch (error) {
			this.loadError = `${file.name}: ${error instanceof Error ? error.message : String(error)}`
			return
		}
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
	private closeFile = async () => {
		++this.loadRevision
		this.sample = demoLog
		this.currentSarifFile = undefined
		this.currentSarifFileName = undefined
		this.sarifFileHandle = undefined
		this.loadError = undefined
		clearRememberedSarifSession(window.sessionStorage)
		try { await indexedDbRememberedSarifStore.remove() }
		catch (error) { this.loadError = `The report was closed, but its fallback copy could not be removed: ${error instanceof Error ? error.message : String(error)}` }
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
				{this.currentSarifFileName && <span className="demoRetentionNote" data-swc-tooltip="This report is stored only in this browser so it can survive refresh. Close and forget removes the remembered copy.">Stored locally</span>}
				{this.currentSarifFileName && <Button text="Close and forget" onClick={() => void this.closeFile()} />}
				<span className="demoSourcePicker" ref={element => this.sourcePickerContainer = element ?? undefined}></span>
				<span style={{ flexGrow: 1 }}></span>
			</div>
			{this.loadError && <div className="demoLoadError" role="alert">{this.loadError}</div>}
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
