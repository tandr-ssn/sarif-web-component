import {Result, Run} from 'sarif'
import {groupPublicReviewVariants, isResultVariantGroup, variantResults} from './ResultVariantGroup'

function publicResult(ruleId: string, line: number, message: string): Result {
	return {
		ruleId,
		message: {text: message},
		locations: [{physicalLocation: {
			artifactLocation: {uri: 'src/service.ts'},
			region: {startLine: line, startColumn: 5, endLine: line, endColumn: 12},
		}}],
		properties: {acah: {classification: 'public-rule-review'}},
	} as unknown as Result
}

function augment(results: Result[]): void {
	const run = {
		tool: {driver: {name: 'ACAH'}},
		properties: {acah: {formatVersion: 3}},
		results,
	} as unknown as Run
	for (const result of results) result.run = run
}

test('groups same-rule same-span public review variants without losing results', () => {
	const results = [
		publicResult('public.rule', 12, 'First interpretation'),
		publicResult('public.rule', 12, 'Second interpretation'),
		publicResult('public.rule', 20, 'Different site'),
	]
	augment(results)

	const grouped = groupPublicReviewVariants(results)
	expect(grouped).toHaveLength(2)
	expect(isResultVariantGroup(grouped[0])).toBe(true)
	expect(variantResults(grouped[0])).toEqual(results.slice(0, 2))
	expect(grouped[1]).toBe(results[2])
})

test('does not group different rules or non-public classifications', () => {
	const left = publicResult('public.left', 12, 'Left')
	const right = publicResult('public.right', 12, 'Right')
	const proven = publicResult('public.left', 12, 'Proven')
	;(proven.properties as any).acah.classification = 'taint-high-confidence'
	const results = [left, right, proven]
	augment(results)

	expect(groupPublicReviewVariants(results)).toEqual(results)
})

test('groups producer-confirmed cross-rule review sites without losing results', () => {
	const left = publicResult('public.left', 12, 'Left interpretation')
	const right = publicResult('public.right', 12, 'Right interpretation')
	const fingerprint = 'a'.repeat(64)
	for (const result of [left, right]) {
		;(result.properties as any).acah = {
			classification: 'public-taint-high-confidence',
			reviewGroup: {
				kind: 'equivalent-public-taint-site',
				memberCount: 2,
				ruleCount: 2,
				fingerprint,
			},
		}
	}
	const results = [left, right]
	augment(results)

	const grouped = groupPublicReviewVariants(results)
	expect(grouped).toHaveLength(1)
	expect(isResultVariantGroup(grouped[0])).toBe(true)
	expect(variantResults(grouped[0])).toEqual(results)
})

test('uses the first filtered cross-rule member as the visible representative', () => {
	const left = publicResult('public.left', 12, 'Left interpretation')
	const right = publicResult('public.right', 12, 'Right interpretation')
	for (const result of [left, right]) {
		;(result.properties as any).acah.reviewGroup = {
			kind: 'equivalent-public-taint-site',
			memberCount: 2,
			ruleCount: 2,
			fingerprint: 'b'.repeat(64),
		}
	}
	augment([left, right])

	expect(groupPublicReviewVariants([right], [right])).toEqual([right])
})
