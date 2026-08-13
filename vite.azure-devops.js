const path = require('path')

function replaceAzureDevOpsFluentIconCSS() {
	return {
		name: 'replace-azure-devops-fluent-icon-css',
		enforce: 'pre',
		resolveId(source, importer) {
			if (source === './FluentIcons.css' && importer && /azure-devops-ui[\\/]Components[\\/]Icon/.test(importer)) {
				return path.resolve(__dirname, 'components/EmptyStyle.css')
			}
			return null
		},
	}
}

function stripLegacyAzureDevOpsMediaQueries() {
	return {
		name: 'strip-legacy-azure-devops-media-queries',
		apply: 'build',
		enforce: 'pre',
		transform(code, id) {
			if (!id.includes('node_modules/azure-devops-ui') || !id.endsWith('.css')) return null
			if (!code.includes('min-width: 0\\0')) return null
			const marker = 'min-width: 0\\0'
			let cursor = 0
			let transformed = ''
			while (true) {
				const mediaStart = code.indexOf('@media', cursor)
				if (mediaStart < 0) {
					transformed += code.slice(cursor)
					break
				}
				const preserveLead = code.slice(cursor, mediaStart)
				const queryStart = code.indexOf('{', mediaStart)
				if (queryStart < 0) {
					transformed += code.slice(cursor)
					break
				}
				const query = code.slice(mediaStart, queryStart)
				if (!query.includes(marker)) {
					const blockEnd = findMatchingClose(code, queryStart)
					if (blockEnd < 0) {
						transformed += code.slice(cursor)
						break
					}
					transformed += code.slice(cursor, blockEnd + 1)
					cursor = blockEnd + 1
					continue
				}
				const blockEnd = findMatchingClose(code, queryStart)
				if (blockEnd < 0) {
					transformed += code.slice(cursor)
					break
				}
				transformed += preserveLead
				cursor = blockEnd + 1
			}
			return {code: transformed, map: null}
		},
	}
}

function findMatchingClose(code, start) {
	let depth = 0
	for (let index = start; index < code.length; index++) {
		const char = code[index]
		if (char === '{') depth += 1
		else if (char === '}') {
			depth -= 1
			if (depth === 0) return index
		}
	}
	return -1
}

module.exports = {replaceAzureDevOpsFluentIconCSS, stripLegacyAzureDevOpsMediaQueries}
