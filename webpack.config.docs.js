const fs = require('fs')
const path = require('path')
const {Compilation, sources} = require('webpack')
const common = require('./webpack.config.common')

class InlineViewerHtmlPlugin {
	apply(compiler) {
		compiler.hooks.thisCompilation.tap('InlineViewerHtmlPlugin', compilation => {
			compilation.hooks.processAssets.tap({
				name: 'InlineViewerHtmlPlugin',
				stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
			}, () => {
				const bundleName = 'index.js'
				const bundleAsset = compilation.getAsset(bundleName)
				if (!bundleAsset) throw new Error(`Missing Webpack asset: ${bundleName}`)
				const licenseAssetName = `${bundleName}.LICENSE.txt`
				const thirdPartyLicenses = compilation.getAsset(licenseAssetName)?.source.source().toString() ?? ''
				const projectLicense = fs.readFileSync(path.join(__dirname, 'LICENSE'), 'utf8').trim()
				const template = fs.readFileSync(path.join(__dirname, 'docs-components/index.template.html'), 'utf8')
				const placeholder = '<script src="index.js"></script>'
				if (!template.includes(placeholder)) throw new Error(`Missing viewer bundle placeholder: ${placeholder}`)

				const notices = [
					`SARIF Viewer license\n\n${projectLicense}`,
					thirdPartyLicenses && `Third-party license notices\n\n${thirdPartyLicenses}`,
				].filter(Boolean).join('\n\n')
				const licenseComment = `<!--\n${notices.replace(/--/g, '- -')}\n-->`
				const bundle = bundleAsset.source.source().toString()
					.replace(/^\/\*! For license information please see [^*]+\*\/\s*/, '')
					.replace(/<\/script/gi, '<\\\\/script')
				const html = template.replace(placeholder, () => `${licenseComment}\n\t\t<script>${bundle}</script>`)

				compilation.emitAsset('index.html', new sources.RawSource(html))
				compilation.deleteAsset(bundleName)
				if (compilation.getAsset(licenseAssetName)) compilation.deleteAsset(licenseAssetName)
			})
		})
	}
}

module.exports = {
	...common,
	mode: 'production',
	entry: {
		'docs': './docs-components/Index.tsx',
	},
	output: {
		path: path.join(__dirname, 'docs'),
		filename: 'index.js',
		libraryTarget: 'umd',
		globalObject: 'this',
		clean: true,
	},
	plugins: [...(common.plugins ?? []), new InlineViewerHtmlPlugin()],
}
