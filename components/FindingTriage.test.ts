import {Result, Run} from 'sarif'
import {FindingTriage, FindingTriageStore, findingIdentityKeys} from './FindingTriage'

class MemoryFindingTriageStore implements FindingTriageStore {
	readonly values = new Set<string>()

	async load(namespace: string) {
		const prefix = `${namespace}\0`
		return {
			keys: [...this.values].filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length)),
			hasAny: this.values.size > 0,
		}
	}

	async setHidden(namespace: string, keys: string[], hidden: boolean) {
		keys.forEach(key => hidden ? this.values.add(`${namespace}\0${key}`) : this.values.delete(`${namespace}\0${key}`))
	}

	async hasAny() { return this.values.size > 0 }
	async clearAll() { this.values.clear() }
}

function result(fingerprint: string, message = 'Synthetic finding', uri = 'src/River.cs'): Result {
	const run = {
		tool: {driver: {name: 'River Scanner'}},
		versionControlProvenance: [{repositoryUri: 'https://example.invalid/river'}],
	} as Run
	return {
		ruleId: 'RIVER001',
		fingerprints: {'primaryLocationLineHash/v1': fingerprint},
		message: {text: message},
		locations: [{physicalLocation: {artifactLocation: {uri}, region: {startLine: 7}}}],
		run,
	} as unknown as Result
}

test('fingerprints preserve identity when presentation details change', () => {
	const before = findingIdentityKeys(result('stable', 'Before', 'src/Before.cs'))
	const after = findingIdentityKeys(result('stable', 'After', 'src/After.cs'))
	expect(before.some(key => after.includes(key))).toBe(true)
})

test('prefers the producer-independent ACAH claim fingerprint', () => {
	const claimId = 'd'.repeat(64)
	const finding = result('detector-specific')
	finding.partialFingerprints = {'acahClaim/v1': claimId, 'acahResult/v1': claimId}
	const keys = findingIdentityKeys(finding)

	expect(keys).toHaveLength(1)
	expect(keys[0]).toMatch(/^v3\0sha256\0[0-9a-f]{64}$/)
	expect(keys[0]).not.toContain('example.invalid')
	expect(keys[0]).not.toContain(claimId)
})

test('stored keys do not expose fallback paths or finding messages', () => {
	const keys = findingIdentityKeys(result('', 'Private advisory text', '/home/alex/calgary/src/River.cs'))
	expect(keys).toHaveLength(1)
	expect(keys[0]).toMatch(/^v3\0sha256\0[0-9a-f]{64}$/)
	expect(keys[0]).not.toContain('/home/alex')
	expect(keys[0]).not.toContain('Private advisory text')
})

test('one canonical key avoids stale fallback aliases when presentation changes', async () => {
	const store = new MemoryFindingTriageStore()
	const before = result('stable', 'Before', 'src/Before.cs')
	const after = result('stable', 'After', 'src/After.cs')
	const triage = new FindingTriage('river', store)
	await triage.load()
	await triage.setHidden([before], true)
	expect(triage.isHidden(after)).toBe(true)
	await triage.setHidden([after], false)
	expect(triage.isHidden(before)).toBe(false)
	expect(store.values.size).toBe(0)
})

test('removes legacy raw identity keys while loading', async () => {
	const store = new MemoryFindingTriageStore()
	store.values.add('river\0v1\0fallback\0["/home/alex/private.cs"]')
	const triage = new FindingTriage('river', store)
	await triage.load()
	expect(store.values.size).toBe(0)
	expect(triage.hasStoredEntries).toBe(false)
})

test('hidden state persists, restores within a namespace, and can be forgotten globally', async () => {
	const store = new MemoryFindingTriageStore()
	const finding = result('finding-a')
	const triage = new FindingTriage('river', store)
	await triage.load()

	await triage.setHidden([finding], true)
	expect(triage.isHidden(finding)).toBe(true)

	const restored = new FindingTriage('river', store)
	await restored.load()
	expect(restored.isHidden(finding)).toBe(true)

	await restored.setHidden([finding], false)
	expect(restored.isHidden(finding)).toBe(false)

	await triage.setHidden([finding], true)
	const other = new FindingTriage('lake', store)
	await other.load()
	await other.setHidden([result('finding-b')], true)
	await triage.forgetAll()

	expect(store.values.size).toBe(0)
	expect(triage.isHidden(finding)).toBe(false)
	expect(triage.hasStoredEntries).toBe(false)
})

test('offers an undo for the most recently hidden findings', async () => {
	jest.useFakeTimers()
	const triage = new FindingTriage('river', new MemoryFindingTriageStore())
	const finding = result('undo')
	await triage.load()
	await triage.setHidden([finding], true)
	expect(triage.recentlyHidden).toEqual([finding])
	expect(triage.isHidden(finding)).toBe(true)
	await triage.undoRecentlyHidden()
	expect(triage.recentlyHidden).toEqual([])
	expect(triage.isHidden(finding)).toBe(false)
	triage.dispose()
	jest.useRealTimers()
})
