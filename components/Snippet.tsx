// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './Snippet.scss'
import * as React from 'react'
import {makeObservable, observable} from 'mobx'
import {observer} from 'mobx-react'
import {hljs} from './SyntaxHighlight'
import 'highlight.js/styles/vs.css'

import {FilterKeywordContext} from './Viewer.Contexts'
import {Hi} from './Hi'
import {PhysicalLocation, Region, Run} from 'sarif'
import {tryOr} from './try'
import {SourceLocationLink} from './SourceLocationLink'
import {SourceTrace} from './SourceFile'

export function trimSnippetIndent(text: string): {text: string, removed: number} {
	const lines = text.replace(/\r/g, '').split('\n')
	const indents = lines
		.filter(line => line.trim().length > 0)
		.map(line => line.match(/^[ \t]*/)?.[0].length ?? 0)
	const removed = indents.length ? Math.min(...indents) : 0
	return {
		text: lines.map(line => line.trim().length ? line.slice(Math.min(removed, line.length)) : '').join('\n'),
		removed,
	}
}

export interface SnippetRegionSegments {
	pre: string
	highlighted: string
	post: string
}

function offsetAfterSnippetTrim(text: string, rawOffset: number, removed: number): number | undefined {
	if (rawOffset < 0 || rawOffset > text.length) return undefined
	let rawPosition = 0
	let renderedPosition = 0
	for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
		const content = match[1]
		const newline = match[2]
		const blank = content.trim().length === 0
		const leadingWhitespace = content.match(/^[ \t]*/)?.[0].length ?? 0
		const omitted = blank ? content.length : Math.min(removed, leadingWhitespace)
		if (rawOffset <= rawPosition + content.length) {
			return renderedPosition + (blank ? 0 : Math.max(0, rawOffset - rawPosition - omitted))
		}
		rawPosition += content.length
		renderedPosition += content.length - omitted
		if (!newline) break
		if (rawOffset < rawPosition + newline.length) return renderedPosition
		rawPosition += newline.length
		renderedPosition++
		if (rawOffset === rawPosition) return renderedPosition
	}
	return rawOffset === rawPosition ? renderedPosition : undefined
}

export function getSnippetRegionSegments(region: Region, contextRegion: Region): SnippetRegionSegments | undefined {
	const contextText = contextRegion.snippet?.text
	if (contextText === undefined) return undefined
	const trimmed = trimSnippetIndent(contextText)
	if (region.startLine === undefined) {
		if (region.charOffset === undefined || region.charLength === undefined || contextRegion.charOffset === undefined) return undefined
		const rawStart = region.charOffset - contextRegion.charOffset
		const rawEnd = rawStart + region.charLength
		const start = offsetAfterSnippetTrim(contextText, rawStart, trimmed.removed)
		const end = offsetAfterSnippetTrim(contextText, rawEnd, trimmed.removed)
		if (start === undefined || end === undefined || end < start) return undefined
		return {pre: trimmed.text.slice(0, start), highlighted: trimmed.text.slice(start, end), post: trimmed.text.slice(end)}
	}

	const lines = trimmed.text.split('\n')
	const minLeadingWhitespace = trimmed.removed
	let {startLine, startColumn = 1, endLine = startLine, endColumn = Number.MAX_SAFE_INTEGER} = region
	let {startLine: contextStartLine = 1, startColumn: contextStartColumn = 1} = contextRegion
	startLine = startLine - contextStartLine
	endLine = endLine - contextStartLine
	startColumn = Math.max(0, startColumn - contextStartColumn - minLeadingWhitespace)
	endColumn = Math.max(0, endColumn - contextStartColumn - minLeadingWhitespace)
	if (!lines[startLine] || !lines[endLine]) return undefined
	const beforeStart = lines.slice(0, startLine).join('\n')
	const start = beforeStart.length + (startLine ? 1 : 0) + Math.min(startColumn, lines[startLine].length)
	const beforeEnd = lines.slice(0, endLine).join('\n')
	const end = beforeEnd.length + (endLine ? 1 : 0) + Math.min(endColumn, lines[endLine].length)
	return {pre: trimmed.text.slice(0, start), highlighted: trimmed.text.slice(start, end), post: trimmed.text.slice(end)}
}

@observer export class Snippet extends React.Component<{ ploc?: PhysicalLocation, run?: Run, trace?: SourceTrace, style?: React.CSSProperties, highlightColor?: string }> {
	static contextType = FilterKeywordContext
	showAll = false

	constructor(props: Snippet['props']) {
		super(props)
		makeObservable(this, {showAll: observable})
	}

	render () {
		const {ploc} = this.props
		if (!ploc) return null
		if (!ploc.region) return null

		let term = this.context

		let body = tryOr(
			() => {
				const {region, contextRegion} = ploc
				if (!contextRegion) return undefined // tryOr fallthrough.

				const trimmed = trimSnippetIndent(contextRegion.snippet.text)
				const crst = trimmed.text

				// Search/Filter highlighting is active so bypass snippet highlighting and return plain text.
				if (term) return crst

				const segments = getSnippetRegionSegments(region, contextRegion)
				if (!segments) return undefined
				return <>{segments.pre}<span className="swcRegion">{segments.highlighted}</span>{segments.post}</>
			},
			() => trimSnippetIndent(ploc.region.snippet.text).text,
		)
		if (!body) return null // May no longer be needed.

		if (term) body = <Hi>{body}</Hi>

		const lineNumbersAndCode = <>
			{tryOr(() => {
				const region = ploc.contextRegion || ploc.region
				if (!region.startLine) return undefined // Don't take up left margin space if there's nothing to show.
				const endLine = region.endLine ?? region.startLine
				let lineNos = ''
				for (let i = region.startLine; i <= endLine; i++) {
					lineNos += `${i}\n`
				}
				return <code className="lineNumber">{lineNos}</code>
			})}
			<code
				className={`hljs flex-grow ${ploc.artifactLocation?.uri?.match(/\.(\w+)$/)?.[1] ?? ''}`}
				style={{}}
				ref={code => {
					if (!code) return
					try {
					hljs.highlightElement(code)
					} catch (_) { /* Keep escaped, unhighlighted source when language detection fails. */ }
				}}>
				{body}
			</code>
		</>

		// title={JSON.stringify(ploc, null, '  ')}
		const snippet = <pre className={`swcSnippet${this.props.highlightColor ? ' swcTraceSnippet' : ''}`}
				style={{
					...this.props.style,
					maxHeight: this.showAll ? undefined : 108,
					...(this.props.highlightColor ? {'--swc-trace-highlight': this.props.highlightColor} : {}),
				} as any} // 108px is a 6-line snippet which is very common.
					onClick={this.props.run ? undefined : () => this.showAll = !this.showAll}
				ref={pre => {
					if (!pre) return
					const isClipped = pre.scrollHeight > pre.clientHeight
					if (isClipped) pre.classList.add('clipped')
					else pre.classList.remove('clipped')
				}}>
				{lineNumbersAndCode}
			</pre>
		return this.props.run
			? <SourceLocationLink ploc={ploc} run={this.props.run} trace={this.props.trace} className="swcSnippetLink">{snippet}</SourceLocationLink>
			: snippet
	}
}

export class SnippetTest extends React.Component {
	render() {
		return <div style={{ padding: 15 }}>
			<Snippet />
			<Snippet ploc={{}} />

			<Snippet ploc={{
				artifactLocation: {
					uri: "https://github.com/Microsoft/sarif-sdk/blob/jeff/src/Sarif/Baseline/ResultMatching/SarifLogMatcher.cs",
					index: 30
				},
				region: {
					startLine: 186,
					endLine: 196,
					snippet: {
						text: "        private ReportingDescriptor GetRuleFromResources(Result result, IDictionary<string, ReportingDescriptor> rules)\r\n        {\r\n            if (!string.IsNullOrEmpty(result.RuleId))\r\n            {\r\n                if (rules.ContainsKey(result.RuleId))\r\n                {\r\n                    return rules[result.RuleId];\r\n                }\r\n            }\r\n            return null;\r\n        }"
					}
				},
				contextRegion: {
					startLine: 183,
					endLine: 199,
					snippet: {
						text: "            return results;\n        }\n        \n        private ReportingDescriptor GetRuleFromResources(Result result, IDictionary<string, ReportingDescriptor> rules)\n        {\n            if (!string.IsNullOrEmpty(result.RuleId))\n            {\n                if (rules.ContainsKey(result.RuleId))\n                {\n                    return rules[result.RuleId];\n                }\n            }\n            return null;\n        }\n\n        private SarifLog ConstructSarifLogFromMatchedResults(\n            IEnumerable<MatchedResults> results, \n"
					}
				}
			}} />

			<Snippet ploc={{
				artifactLocation: { uri: 'folder/file.txt' },
				region: {
					snippet: { text: 'Basic.' },
				},
			}} />

			<Snippet ploc={{
				artifactLocation: { uri: 'folder/file.txt' },
				region: {
					snippet: { text: 'Content region.' },
					charOffset: 13 // charOffset currently ignored by snippet rendering.
				},
				contextRegion: {
					snippet: { text: 'Surrounding. Content region. Surrounding. Currently not rendered if no startLine.' },
				}
			}} />

			<Snippet ploc={{
				artifactLocation: {
					uri: "https://github.com/Microsoft/sarif-sdk/blob/jeff/src/Sarif.UnitTests/FileRegionsCacheTests.cs",
					index: 15,
				},
				region: {
					startLine: 107,
					endLine: 107,
				},
				contextRegion: {
					startLine: 106,
					startColumn: 1,
					endLine: 108,
					endColumn: 91,
					charOffset: 5693, // charOffset currently ignored by snippet rendering.
					charLength: 157, // charLength currently ignored by snippet rendering.
					snippet: {
						text: "\r\n        private readonly static Region s_Interior_Characters = \r\n            new Region() { Snippet = new ArtifactContent() { Text = INTERIOR_CHARACTERS },"
					},
				},
			}} />

			<Snippet ploc={{
				artifactLocation: {
					uri: "https://github.com/Microsoft/sarif-sdk/blob/jeff/src/Sarif/Visitors/SarifCurrentToVersionOneVisitor.cs",
					index: 0,
				},
				region: {
					startLine: 780,
					endLine: 780,
					snippet: {
						text: "                    (result.Fixes as List<FixVersionOne>).RemoveAll(f => f == null);"
					},
				},
				contextRegion: {
					startLine: 777,
					endLine: 783,
					snippet: {
						text: "                if (result.Fixes != null)\n                {\n                    // Null Fixes will be present in the case of unsupported encoding\n                    (result.Fixes as List<FixVersionOne>).RemoveAll(f => f == null);\n\n                    if (result.Fixes.Count == 0)\n                    {\n"
					},
				}
			}} />

			<Snippet ploc={{
				artifactLocation: { uri: 'folder/file1.txt' },
				region: {
					snippet: { text: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7 (Last line before fold) \nLine 8\nLine 9\nLine 10' },
				},
			}} />

			<Snippet ploc={{
				artifactLocation: { uri: 'folder/file1.txt' },
				contextRegion: {
					snippet: { text: '    Normalize indent: Typical\n    All lines have a least a 4 space indent\n\n    Except for empty lines (like above)\n    highlighted\n        Some lines have 8 spaces' },
				},
				region: {
					startLine: 4,
					startColumn: 5,
					snippet: {
						text: 'highlighted'
					},
				},
			}} />

			<Snippet ploc={{
				artifactLocation: { uri: 'folder/file1.txt' },
				region: {
					snippet: { text: '    Normalize indent: Currently does not apply if no context region (but maybe it should)' },
				},
			}} />

			<Snippet ploc={{
				artifactLocation: {
					uri: "https://github.com/Microsoft/sarif-sdk/blob/jeff/src/Sarif/Visitors/SarifCurrentToVersionOneVisitor.cs",
					index: 0,
				},
				contextRegion: {
					startLine: 100, // endLine defaults to startLine
					startColumn: 1, // 1-based
					snippet: {
						text: "aaabbbaaa"
					},
				},
				region: {
					startLine: 100, // endLine defaults to startLine
					startColumn: 4, // 1-based
					endColumn: 7, // 1-based
					snippet: {
						text: "bbb"
					},
				},
			}} />

			<Snippet ploc={{
				"artifactLocation": {
					"uri": "https://dev.azure.com/org/_workitems/edit/12345"
				},
				"region": {
					"startLine": 122,
					"startColumn": 875,
					"endLine": 122,
					"endColumn": 895,
					"charOffset": 9478, // charOffset currently ignored by snippet rendering.
					"charLength": 20, // charLength currently ignored by snippet rendering.
					"snippet": {
						"text": "789</span></div><div"
					}
				},
				"contextRegion": {
					"startLine": 122,
					"startColumn": 747,
					"endLine": 122,
					"endColumn": 1023,
					"charOffset": 9350, // charOffset currently ignored by snippet rendering.
					"charLength": 276, // charLength currently ignored by snippet rendering.
					"snippet": {
						"text": "le=\\\"box-sizing:border-box;\\\"><span style=\\\"box-sizing:border-box;\\\">1. Sign into Houston POS with username 123456 and password 789</span></div><div style=\\\"box-sizing:border-box;\\\"><span style=\\\"box-sizing:border-box;\\\">2. Do an exchange for item 0001</span></div><div style="
					}
				}
			}} />	
		</div>
	}
}
