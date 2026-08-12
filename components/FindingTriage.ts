import {observable, runInAction} from 'mobx'
import {Result, Run} from 'sarif'
import {getResultClaim} from './Acah'
import {stableSha256} from './StableHash'

export interface StoredFindingTriage {
	keys: string[]
	hasAny: boolean
}

export interface FindingTriageStore {
	load(namespace: string): Promise<StoredFindingTriage>
	setHidden(namespace: string, keys: string[], hidden: boolean): Promise<void>
	hasAny(): Promise<boolean>
	clearAll(): Promise<void>
}

function sortedEntries(values: {[key: string]: string} | undefined): Array<[string, string]> {
	return Object.entries(values ?? {}).sort(([left], [right]) => left.localeCompare(right))
}

function findingContext(result: Result): string[] {
	const run = result.run as Run | undefined
	const driver = run?.tool?.driver
	const repository = run?.versionControlProvenance?.[0]?.repositoryUri ?? ''
	return [driver?.guid ?? driver?.name ?? '', repository, result.ruleId ?? result._rule?.id ?? '']
}

function fallbackIdentity(result: Result): unknown[] {
	const location = result.locations?.[0]
	const physical = location?.physicalLocation
	const artifact = physical?.artifactLocation ?? result.analysisTarget
	const region = physical?.region
	const logical = location?.logicalLocations?.[0]
	return [
		...findingContext(result),
		artifact?.uri ?? (artifact?.index === undefined ? '' : `#${artifact.index}`),
		region?.startLine ?? 0,
		region?.startColumn ?? 0,
		region?.endLine ?? region?.startLine ?? 0,
		region?.endColumn ?? 0,
		logical?.fullyQualifiedName ?? logical?.decoratedName ?? logical?.name ?? '',
		result.message?.text ?? result.message?.markdown ?? '',
	]
}

/** Stable aliases used to carry local triage state across scans from the same producer. */
export function findingIdentityKeys(result: Result): string[] {
	const context = findingContext(result)
	const claimId = result.partialFingerprints?.['acahClaim/v1'] ?? getResultClaim(result)?.id
	if (typeof claimId === 'string' && /^[0-9a-f]{64}$/.test(claimId)) {
		const repository = result.run?.versionControlProvenance?.[0]?.repositoryUri ?? ''
		return [`v3\0sha256\0${stableSha256(JSON.stringify(['acah-claim', repository, claimId]))}`]
	}
	let identity: unknown[] | undefined
	if (result.guid) identity = ['guid', ...context, result.guid]
	const fingerprints = sortedEntries(result.fingerprints)
	if (!identity && fingerprints.length) identity = ['fingerprints', ...context, fingerprints]
	const partialFingerprints = sortedEntries(result.partialFingerprints)
	if (!identity && partialFingerprints.length) identity = ['partial', ...context, partialFingerprints]
	identity ??= ['fallback', ...fallbackIdentity(result)]
	return [`v3\0sha256\0${stableSha256(JSON.stringify(identity))}`]
}

export class FindingTriage {
	@observable ready = false
	@observable pending = false
	@observable hasStoredEntries = false
	@observable private revision = 0
	@observable.ref recentlyHidden: Result[] = []
	private hiddenKeys = new Set<string>()
	private recentlyHiddenTimer?: number

	constructor(readonly namespace: string, readonly store: FindingTriageStore) { }

	async load(): Promise<void> {
		const stored = await this.store.load(this.namespace)
		const keys = stored.keys.filter(key => key.startsWith('v3\0sha256\0'))
		const legacyKeys = stored.keys.filter(key => !key.startsWith('v3\0sha256\0'))
		if (legacyKeys.length) await this.store.setHidden(this.namespace, legacyKeys, false)
		const hasAny = legacyKeys.length ? await this.store.hasAny() : stored.hasAny
		runInAction(() => {
			this.hiddenKeys = new Set(keys)
			this.hasStoredEntries = hasAny
			this.ready = true
			this.revision++
		})
	}

	isHidden(result: Result): boolean {
		this.revision
		return findingIdentityKeys(result).some(key => this.hiddenKeys.has(key))
	}

	hiddenCount(results: Result[]): number {
		return results.reduce((count, result) => count + (this.isHidden(result) ? 1 : 0), 0)
	}

	async setHidden(results: Result[], hidden: boolean): Promise<void> {
		if (this.pending || !results.length) return
		const keys = Array.from(new Set(results.flatMap(findingIdentityKeys)))
		const previous = new Map(keys.map(key => [key, this.hiddenKeys.has(key)]))
		runInAction(() => {
			this.pending = true
			keys.forEach(key => hidden ? this.hiddenKeys.add(key) : this.hiddenKeys.delete(key))
			if (hidden) this.hasStoredEntries = true
			this.revision++
		})
		try {
			await this.store.setHidden(this.namespace, keys, hidden)
			const hasAny = hidden ? true : await this.store.hasAny()
			runInAction(() => {
				this.hasStoredEntries = hasAny
				if (hidden) this.recentlyHidden = results.slice()
				else if (results.some(result => this.recentlyHidden.includes(result))) this.recentlyHidden = []
			})
			if (hidden) {
				if (this.recentlyHiddenTimer !== undefined) window.clearTimeout(this.recentlyHiddenTimer)
				this.recentlyHiddenTimer = window.setTimeout(() => runInAction(() => this.recentlyHidden = []), 8000)
			}
		} catch (error) {
			runInAction(() => {
				previous.forEach((wasHidden, key) => wasHidden ? this.hiddenKeys.add(key) : this.hiddenKeys.delete(key))
				this.revision++
			})
			throw error
		} finally {
			runInAction(() => this.pending = false)
		}
	}

	async undoRecentlyHidden(): Promise<void> {
		const results = this.recentlyHidden.slice()
		if (!results.length) return
		await this.setHidden(results, false)
	}

	dispose() {
		if (this.recentlyHiddenTimer !== undefined) window.clearTimeout(this.recentlyHiddenTimer)
	}

	async forgetAll(): Promise<void> {
		if (this.pending) return
		const previous = this.hiddenKeys
		runInAction(() => {
			this.pending = true
			this.hiddenKeys = new Set()
			this.hasStoredEntries = false
			this.revision++
		})
		try {
			await this.store.clearAll()
		} catch (error) {
			runInAction(() => {
				this.hiddenKeys = previous
				this.hasStoredEntries = previous.size > 0
				this.revision++
			})
			throw error
		} finally {
			runInAction(() => this.pending = false)
		}
	}
}

const databaseName = 'sarif-web-component'
const storeName = 'hidden-finding-state'

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (!window.indexedDB) return reject(new Error('IndexedDB is unavailable'))
		const request = window.indexedDB.open(databaseName, 1)
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName)
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error ?? new Error('Unable to open finding-state database'))
	})
}

function namespacePrefix(namespace: string): string {
	return `${namespace}\0`
}

function namespaceRange(namespace: string): IDBKeyRange {
	const prefix = namespacePrefix(namespace)
	return IDBKeyRange.bound(prefix, `${prefix}\uffff`)
}

export const indexedDbFindingTriageStore: FindingTriageStore = {
	load: namespace => openDatabase().then(database => new Promise<StoredFindingTriage>((resolve, reject) => {
		const transaction = database.transaction(storeName, 'readonly')
		const store = transaction.objectStore(storeName)
		const keysRequest = store.getAllKeys(namespaceRange(namespace))
		const countRequest = store.count()
		transaction.oncomplete = () => {
			database.close()
			const prefix = namespacePrefix(namespace)
			resolve({
				keys: keysRequest.result.map(key => String(key).slice(prefix.length)),
				hasAny: countRequest.result > 0,
			})
		}
		transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Unable to load finding state')) }
		transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Unable to load finding state')) }
	})),
	setHidden: (namespace, keys, hidden) => openDatabase().then(database => new Promise<void>((resolve, reject) => {
		const transaction = database.transaction(storeName, 'readwrite')
		const store = transaction.objectStore(storeName)
		const prefix = namespacePrefix(namespace)
		keys.forEach(key => hidden ? store.put(true, prefix + key) : store.delete(prefix + key))
		transaction.oncomplete = () => { database.close(); resolve() }
		transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Unable to save finding state')) }
		transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Unable to save finding state')) }
	})),
	hasAny: () => openDatabase().then(database => new Promise<boolean>((resolve, reject) => {
		const transaction = database.transaction(storeName, 'readonly')
		const request = transaction.objectStore(storeName).count()
		transaction.oncomplete = () => { database.close(); resolve(request.result > 0) }
		transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Unable to inspect finding state')) }
		transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Unable to inspect finding state')) }
	})),
	clearAll: () => openDatabase().then(database => new Promise<void>((resolve, reject) => {
		const transaction = database.transaction(storeName, 'readwrite')
		transaction.objectStore(storeName).clear()
		transaction.oncomplete = () => { database.close(); resolve() }
		transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Unable to clear finding state')) }
		transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Unable to clear finding state')) }
	})),
}
