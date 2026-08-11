import {loadRememberedSarifFromSession, rememberSarif, RememberedSarif, RememberedSarifStore} from './SarifSession'

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
		['sarif-web-component:docs:sarif', '{"old":true}'],
		['sarif-web-component:docs:sarif:name', 'Bow River.sarif'],
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
