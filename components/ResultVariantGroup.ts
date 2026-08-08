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

export function isResultVariantGroup(value: unknown): value is ResultVariantGroup {
	return !!value && typeof value === 'object' && (value as ResultVariantGroup).isResultVariantGroup === true
}

/** Groups only presentation-equivalent public review sites; every SARIF result is retained. */
export function groupPublicReviewVariants(results: Result[]): Array<Result | ResultVariantGroup> {
	const groups = new Map<string, Result[]>()
	for (const result of results) {
		if (!isLowConfidencePublicReview(result)) continue
		const key = primarySiteKey(result)
		if (key) groups.set(key, [...(groups.get(key) ?? []), result])
	}

	const emitted = new Set<string>()
	const grouped: Array<Result | ResultVariantGroup> = []
	for (const result of results) {
		const key = isLowConfidencePublicReview(result) ? primarySiteKey(result) : undefined
		const variants = key ? groups.get(key) : undefined
		if (!key || !variants || variants.length < 2) {
			grouped.push(result)
			continue
		}
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
