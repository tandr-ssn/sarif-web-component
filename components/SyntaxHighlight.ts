// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as hljs from 'highlight.js/lib/core'

hljs.registerLanguage('csharp', require('highlight.js/lib/languages/csharp'))
hljs.registerLanguage('go', require('highlight.js/lib/languages/go'))
hljs.registerLanguage('java', require('highlight.js/lib/languages/java'))
hljs.registerLanguage('json', require('highlight.js/lib/languages/json'))
hljs.registerLanguage('typescript', require('highlight.js/lib/languages/typescript'))
hljs.registerLanguage('xml', require('highlight.js/lib/languages/xml'))

const languagesByExtension = new Map<string, string>([
	['cs', 'csharp'],
	['go', 'go'],
	['java', 'java'],
	['js', 'typescript'],
	['jsx', 'typescript'],
	['json', 'json'],
	['ts', 'typescript'],
	['tsx', 'typescript'],
	['csproj', 'xml'],
	['html', 'xml'],
	['xaml', 'xml'],
	['xml', 'xml'],
])

export {hljs}

/** Returns escaped, syntax-colored HTML, or undefined for an unknown file type. */
export function highlightSourceSegment(text: string, fileName: string): string | undefined {
	const extension = fileName.match(/\.([^.?#/]+)(?:[?#].*)?$/)?.[1]?.toLowerCase()
	const language = extension && languagesByExtension.get(extension)
	if (!language) return undefined
	try {
		return hljs.highlight(text, { language, ignoreIllegals: true }).value
	} catch (_) {
		return undefined
	}
}
