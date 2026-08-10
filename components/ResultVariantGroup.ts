// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {Result} from 'sarif'
import {getResultAcah} from './Acah'
import {ResultVariantGroup} from './Viewer.Types'

function primarySiteKey(result: Result): string | undefined {
	const location = result.locations?.[0]?.physicalLocation
	const artifact = location?.artifactLocation
	const region = location?.region
	const artifactIdentity = artifact?.uri ?? (artifact?.index === undefined ? undefined : `#${artifact.index}`)
	if (!artifactIdentity || region?.startLine === undefined) return undefined
	return [
		result.ruleId ?? result._rule?.id ?? '',
		artifactIdentity,
		region.startLine,
		region.startColumn ?? 0,
		region.endLine ?? region.startLine,
		region.endColumn ?? 0,
	].join('\u0000')
}

function isLowConfidencePublicReview(result: Result): boolean {
	return getResultAcah(result)?.classification === 'public-rule-review'
}

function producerReviewGroupKey(result: Result): string | undefined {
	const acah = getResultAcah(result)
	const classification = acah?.classification
	if (classification !== 'public-rule-review' && classification !== 'public-taint-high-confidence') return undefined
	const reviewGroup = acah?.reviewGroup
	if (!reviewGroup || typeof reviewGroup !== 'object') return undefined
	if (reviewGroup.kind !== 'equivalent-public-taint-site') return undefined
	if (typeof reviewGroup.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(reviewGroup.fingerprint)) return undefined
	if (!Number.isInteger(reviewGroup.memberCount) || reviewGroup.memberCount < 2) return undefined
	if (!Number.isInteger(reviewGroup.ruleCount) || reviewGroup.ruleCount < 2) return undefined
	return `acah-review-group\u0000${reviewGroup.fingerprint}`
}

function variantGroupKey(result: Result): string | undefined {
	return producerReviewGroupKey(result)
		?? (isLowConfidencePublicReview(result) ? primarySiteKey(result) : undefined)
}

export function isResultVariantGroup(value: unknown): value is ResultVariantGroup {
	return !!value && typeof value === 'object' && (value as ResultVariantGroup).isResultVariantGroup === true
}

/** Groups only presentation-equivalent public review sites; every SARIF result is retained. */
export function groupPublicReviewVariants(
	results: Result[],
	population: Result[] = results,
): Array<Result | ResultVariantGroup> {
	const groups = new Map<string, Result[]>()
	for (const result of population) {
		const key = variantGroupKey(result)
		if (key) groups.set(key, [...(groups.get(key) ?? []), result])
	}

	const emitted = new Set<string>()
	const grouped: Array<Result | ResultVariantGroup> = []
	for (const result of results) {
		const key = variantGroupKey(result)
		const variants = key ? groups.get(key) : undefined
		if (!key || !variants || variants.length < 2) {
			grouped.push(result)
			continue
		}
		if (variants[0] !== result) continue
		if (emitted.has(key)) continue
		emitted.add(key)
		grouped.push({
			isResultVariantGroup: true,
			results: variants,
			representative: variants[0],
		})
	}
	return grouped
}

export function resultVariantCount(value: Result | ResultVariantGroup): number {
	return isResultVariantGroup(value) ? value.results.length : 1
}

export function variantResults(value: Result | ResultVariantGroup): Result[] {
	return isResultVariantGroup(value) ? value.results : [value]
}
