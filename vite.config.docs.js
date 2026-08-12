const path = require('path')
const react = require('@vitejs/plugin-react')
const fs = require('fs')
const {defineConfig} = require('vite')
const {extname} = path

const inlineMimeTypes = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
}

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

function buildUnifiedAcahViewerHtml() {
	return {
		name: 'build-unified-acah-viewer-html',
		writeBundle(_options, bundle) {
			const htmlBundleFile = Object.keys(bundle ?? {}).find((fileName) => fileName.endsWith('.html'))
			if (!htmlBundleFile) {
				return
			}
			const source = path.resolve(__dirname, 'dist', 'docs-components', htmlBundleFile)
			const destination = path.resolve(__dirname, 'dist', 'acah-viewer.html')
			const sourceDir = path.dirname(source)
			let html = fs.readFileSync(source, 'utf8')
			const mime = (assetPath) => inlineMimeTypes[extname(assetPath).toLowerCase()] ?? 'application/octet-stream'
			const inlineCss = (css, fromFile) => css.replace(/url\(([^)]+)\)/g, (match, value) => {
				const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
				if (/^([a-z]+:)?\/\//.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
					return match
				}
				const absolute = path.resolve(path.dirname(fromFile), trimmed)
				if (!absolute.startsWith(path.resolve(__dirname, 'dist'))) {
					return match
				}
				try {
					const data = fs.readFileSync(absolute)
					const type = mime(absolute)
					return `url("data:${type};base64,${data.toString('base64')}")`
				} catch {
					return match
				}
			})
			html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/g, (match, href) => {
				if (!href || /^https?:\/\/|^\/\//i.test(href) || href.startsWith('data:')) {
					return match
				}
				const sourcePath = path.resolve(sourceDir, href)
				const css = fs.readFileSync(sourcePath, 'utf8')
				return `<style>${inlineCss(css, sourcePath)}</style>`
			})
			html = html.replace(/<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["'][^>]*>/g, '')
			html = html.replace(/<script([^>]*?)\s+src=["']([^"']+)["']([^>]*)><\/script>/g, (match, preAttrs, src, postAttrs) => {
				const sourcePath = path.resolve(sourceDir, src)
				const scriptType = /type=["']([^"']+)["']/i.exec(`${preAttrs} ${postAttrs}`)?.[1] ?? 'text/javascript'
				const script = fs.readFileSync(sourcePath, 'utf8')
				const typeAttr = preAttrs.includes('type=') || postAttrs.includes('type=') ? '' : ` type="${scriptType}"`
				return `<script${typeAttr}${preAttrs}${postAttrs}>${script}</script>`
			})
			if (fs.existsSync(source)) {
				try {
					fs.rmSync(destination, {force: true})
					fs.writeFileSync(destination, html)
				} catch (error) {
					// fallback to ignore write failures only after best-effort
					throw error
				}
			}
		},
	}
}

module.exports = defineConfig(({command}) => ({
	plugins: [replaceAzureDevOpsFluentIconCSS(), stripLegacyAzureDevOpsMediaQueries(), buildUnifiedAcahViewerHtml(), react()],
	base: command === 'build' ? './' : '/',
	css: {
		transformer: 'postcss',
		lightningcss: {
			errorRecovery: true,
		},
	},
	build: {
		outDir: 'dist/docs-components',
		emptyOutDir: true,
		target: 'es2022',
		cssCodeSplit: false,
		rollupOptions: {
			input: path.resolve(__dirname, 'docs-components/index.html'),
			output: {
				codeSplitting: false,
				entryFileNames: 'index.js',
				assetFileNames: 'assets/[name][extname]',
			},
		},
	},
}))
