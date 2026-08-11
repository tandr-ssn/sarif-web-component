export interface RememberedSarif {
	name: string
	text: string
}

export interface RememberedSarifStore {
	get(): Promise<RememberedSarif | undefined>
	put(value: RememberedSarif): Promise<void>
	remove(): Promise<void>
}

const docsSessionKey = 'sarif-web-component:docs'
const sarifSessionKey = `${docsSessionKey}:sarif`
const sarifNameSessionKey = `${sarifSessionKey}:name`

export function loadRememberedSarifFromSession(storage: Storage): RememberedSarif | undefined {
	try {
		const text = storage.getItem(sarifSessionKey)
		const name = storage.getItem(sarifNameSessionKey)
		return text && name ? {name, text} : undefined
	} catch (_) {
		return undefined
	}
}

function clearSession(storage: Storage): void {
	try {
		storage.removeItem(sarifSessionKey)
		storage.removeItem(sarifNameSessionKey)
	} catch (_) { }
}

export async function rememberSarif(value: RememberedSarif, storage: Storage, fallback: RememberedSarifStore): Promise<void> {
	try {
		storage.setItem(sarifSessionKey, value.text)
		storage.setItem(sarifNameSessionKey, value.name)
	} catch (_) {
		clearSession(storage)
		try {
			await fallback.put(value)
		} catch (error) {
			// IndexedDB replacement is atomic, so remove an older value if the new value exceeded its quota.
			try { await fallback.remove() } catch (_) { }
			throw error
		}
		return
	}
	// The session entry is authoritative; deleting an older fallback is best effort.
	try { await fallback.remove() } catch (_) { }
}

const databaseName = 'sarif-web-component-docs'
const storeName = 'remembered-sarif'
const entryKey = 'docs-current'

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (!window.indexedDB) {
			reject(new Error('IndexedDB is unavailable'))
			return
		}
		const request = window.indexedDB.open(databaseName, 1)
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName)
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'))
	})
}

function databaseRequest<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	return openDatabase().then(database => new Promise<T>((resolve, reject) => {
		const transaction = database.transaction(storeName, mode)
		const request = action(transaction.objectStore(storeName))
		let result: T
		request.onsuccess = () => result = request.result
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
		transaction.oncomplete = () => {
			database.close()
			resolve(result)
		}
		transaction.onabort = () => {
			database.close()
			reject(transaction.error ?? new Error('IndexedDB transaction failed'))
		}
	}))
}

export const indexedDbRememberedSarifStore: RememberedSarifStore = {
	get: () => databaseRequest('readonly', store => store.get(entryKey)),
	put: value => databaseRequest('readwrite', store => store.put(value, entryKey)).then(() => undefined),
	remove: () => databaseRequest('readwrite', store => store.delete(entryKey)).then(() => undefined),
}

export {docsSessionKey}
