export interface RememberedSarif {
	name: string
	text: string
}

export interface RememberedSarifStore {
	get(): Promise<RememberedSarif | undefined>
	put(value: RememberedSarif): Promise<void>
	remove(): Promise<void>
}

const docsSessionKey = '@acah/sarif-web-component:docs'
const legacyDocsSessionKey = 'sarif-web-component:docs'
const sarifSessionKey = `${docsSessionKey}:sarif`
const legacySarifSessionKey = `${legacyDocsSessionKey}:sarif`
const sarifNameSessionKey = `${sarifSessionKey}:name`
const legacySarifNameSessionKey = `${legacySarifSessionKey}:name`

const sessionStorageKeys = [
	{sarif: sarifSessionKey, name: sarifNameSessionKey},
	{sarif: legacySarifSessionKey, name: legacySarifNameSessionKey},
]

export function loadRememberedSarifFromSession(storage: Storage): RememberedSarif | undefined {
	try {
		for (const keys of sessionStorageKeys) {
			const text = storage.getItem(keys.sarif)
			const name = storage.getItem(keys.name)
			if (text && name) return {name, text}
		}
	} catch (_) {
		return undefined
	}
	return undefined
}

export function clearRememberedSarifSession(storage: Storage): void {
	try {
		sessionStorageKeys.forEach(keys => {
			storage.removeItem(keys.sarif)
			storage.removeItem(keys.name)
		})
	} catch (_) { }
}

export async function rememberSarif(value: RememberedSarif, storage: Storage, fallback: RememberedSarifStore): Promise<void> {
	try {
		storage.setItem(sarifSessionKey, value.text)
		storage.setItem(sarifNameSessionKey, value.name)
	} catch (_) {
		clearRememberedSarifSession(storage)
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

const storeName = 'remembered-sarif'
const entryKey = 'docs-current'
const databaseName = '@acah/sarif-web-component-docs'
const legacyDatabaseName = 'sarif-web-component-docs'
const databaseNames = [databaseName, legacyDatabaseName]

function openDatabase(databaseName: string): Promise<IDBDatabase> {
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

function databaseRequest<T>(databaseName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	return openDatabase(databaseName).then(database => new Promise<T>((resolve, reject) => {
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
	get: async () => {
		for (const currentDatabaseName of databaseNames) {
			try { const value = await databaseRequest(currentDatabaseName, 'readonly', store => store.get(entryKey)); if (value) return value as RememberedSarif }
			catch (_) { }
		}
		return undefined
	},
	put: value => databaseRequest(databaseName, 'readwrite', store => store.put(value, entryKey)).then(() => undefined),
	remove: () => databaseRequest(databaseName, 'readwrite', store => store.delete(entryKey)).then(() => undefined),
}

export {docsSessionKey, legacyDocsSessionKey}
