// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {Result} from 'sarif'
import {Rule} from './Viewer.Types'
import {isResultVariantGroup} from './ResultVariantGroup'

export function getRuleTooltip(rule: Rule): string {
	return rule.fullDescription?.text?.trim()
		|| rule.shortDescription?.text?.trim()
		|| 'No description was included for this rule.'
}

export function getTreeRowClass(data: unknown): string | undefined {
	if ((data as Rule | undefined)?.isRule) return 'swcRuleRow'

	const result = isResultVariantGroup(data)
		? data.representative
		: data && typeof data === 'object' && 'message' in data ? data as Result : undefined
	if (!result) return undefined

	switch (result.level ?? 'warning') {
		case 'error': return 'swcResultError'
		case 'warning': return 'swcResultWarning'
		case 'note': return 'swcResultNote'
		case 'none':
			if (result.kind === 'fail') return 'swcResultError'
			if (result.kind === 'pass') return 'swcResultSuccess'
			return undefined
	}
}
