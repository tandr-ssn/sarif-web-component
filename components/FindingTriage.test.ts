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
