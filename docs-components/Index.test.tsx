import {Index} from './Index'
import {loadRememberedSarifFromSession} from './SarifSession'

class DeferredFileReader {
	static pending: DeferredFileReader[] = []
	result?: string
	onload?: () => void
	onerror?: () => void

	readAsText() {
		DeferredFileReader.pending.push(this)
	}

	resolve(text: string) {
		this.result = text
		this.onload?.()
	}
}

test('an earlier file read cannot replace the latest opened SARIF file', async () => {
	const OriginalFileReader = window.FileReader
	window.sessionStorage.clear()
	DeferredFileReader.pending = []
	;(window as any).FileReader = DeferredFileReader
	try {
		const index = new Index({})
		const first = index.loadFile({name: 'Bow River.sarif'} as File)
		const second = index.loadFile({name: 'North River.sarif'} as File)

		DeferredFileReader.pending[1].resolve('{"version":"2.1.0","runs":[]}')
		await second
		DeferredFileReader.pending[0].resolve('{not valid JSON from a stale read')
		await first

		expect(index.currentSarifFileName).toBe('North River.sarif')
		expect(index.sample).toEqual({version: '2.1.0', runs: []})
		expect(loadRememberedSarifFromSession(window.sessionStorage)?.name).toBe('North River.sarif')
	} finally {
		;(window as any).FileReader = OriginalFileReader
		window.sessionStorage.clear()
	}
})
