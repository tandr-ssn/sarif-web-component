import {docsSessionKey, legacyDocsSessionKey, loadRememberedSarifFromSession, rememberSarif, RememberedSarif, RememberedSarifStore} from './SarifSession'

function fallback(initial?: RememberedSarif): RememberedSarifStore & {value?: RememberedSarif} {
	return {
		value: initial,
		async get() { return this.value },
		async put(value) { this.value = value },
		async remove() { this.value = undefined },
	}
}

test('replaces a remembered session SARIF entry', async () => {
	const storage = window.sessionStorage
	const largeStore = fallback({name: 'Bow River.sarif', text: '{"old":true}'})

	await rememberSarif({name: 'North River.sarif', text: '{"new":true}'}, storage, largeStore)

	expect(loadRememberedSarifFromSession(storage)).toEqual({name: 'North River.sarif', text: '{"new":true}'})
	expect(largeStore.value).toBeUndefined()
	storage.clear()
})

test('keeps a successful session entry when fallback cleanup is unavailable', async () => {
	const storage = window.sessionStorage
	const largeStore = fallback({name: 'Bow River.sarif', text: '{"old":true}'})
	largeStore.remove = async () => { throw new Error('IndexedDB unavailable') }

	await rememberSarif({name: 'North River.sarif', text: '{"new":true}'}, storage, largeStore)

	expect(loadRememberedSarifFromSession(storage)).toEqual({name: 'North River.sarif', text: '{"new":true}'})
	storage.clear()
})

test('clears a stale session entry and falls back when the replacement exceeds its quota', async () => {
	const values = new Map<string, string>([
		[`${legacyDocsSessionKey}:sarif`, '{"old":true}'],
		[`${legacyDocsSessionKey}:sarif:name`, 'Bow River.sarif'],
	])
	const storage = {
		getItem: key => values.get(key) ?? null,
		setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError') },
		removeItem: key => { values.delete(key) },
	} as unknown as Storage
	const largeStore = fallback()

	await rememberSarif({name: 'North River.sarif', text: '{"new":true}'}, storage, largeStore)

	expect(loadRememberedSarifFromSession(storage)).toBeUndefined()
	expect(largeStore.value).toEqual({name: 'North River.sarif', text: '{"new":true}'})
})

test('removes an older fallback entry if its replacement cannot be stored', async () => {
	const storage = {setItem: () => { throw new Error('unavailable') }, removeItem: jest.fn()} as unknown as Storage
	const largeStore = fallback({name: 'Bow River.sarif', text: '{"old":true}'})
	largeStore.put = async () => { throw new DOMException('Quota exceeded', 'QuotaExceededError') }

	await expect(rememberSarif({name: 'North River.sarif', text: '{"new":true}'}, storage, largeStore)).rejects.toThrow('Quota exceeded')
	expect(largeStore.value).toBeUndefined()
})

test('loads the session entry from legacy keys when the new keys are absent', () => {
	window.sessionStorage.setItem(`${legacyDocsSessionKey}:sarif`, '{"old":true}')
	window.sessionStorage.setItem(`${legacyDocsSessionKey}:sarif:name`, 'North River.sarif')

	expect(loadRememberedSarifFromSession(window.sessionStorage)).toEqual({
		name: 'North River.sarif',
		text: '{"old":true}',
	})
	window.sessionStorage.clear()
})

test('prefers the new key when both new and legacy session values are available', () => {
	window.sessionStorage.setItem(`${legacyDocsSessionKey}:sarif`, '{"old":true}')
	window.sessionStorage.setItem(`${legacyDocsSessionKey}:sarif:name`, 'Legacy.sarif')
	window.sessionStorage.setItem(`${docsSessionKey}:sarif`, '{"new":true}')
	window.sessionStorage.setItem(`${docsSessionKey}:sarif:name`, 'Current.sarif')

	expect(loadRememberedSarifFromSession(window.sessionStorage)).toEqual({
		name: 'Current.sarif',
		text: '{"new":true}',
	})
	window.sessionStorage.clear()
})
