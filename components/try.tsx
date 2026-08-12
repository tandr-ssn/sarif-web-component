// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react'
import {Link} from './AzureDevOpsUi'
import {safeLinkHref} from './SafeLink'

export const tryLink = (fHref: () => string, inner: string | JSX.Element, className?: string, onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void) => {
	try {
		const href = safeLinkHref(fHref())
		if (!href) throw null
		return <Link
			className={className} // "bolt-table-link bolt-table-inline-link"
			excludeTabStop
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			onClick={onClick}>
			{inner}
		</Link>
	}
	catch (e) { return inner }
}

export function tryOr<T = any>(...functions) {
	for (const func of functions) {		
		if (typeof func !== 'function') return func as T // A non-function constant value.
		try {
			const value = func()
			if (!value) continue
			return value as T
		}
		catch (e) {}
	}
}
