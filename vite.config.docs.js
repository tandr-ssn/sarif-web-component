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
	plugins: [replaceAzureDevOpsFluentIconCSS(), buildUnifiedAcahViewerHtml(), react()],
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
