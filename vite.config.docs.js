const path = require('path')
const react = require('@vitejs/plugin-react')
const {defineConfig} = require('vite')

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

module.exports = defineConfig(({command}) => ({
	plugins: [replaceAzureDevOpsFluentIconCSS(), react()],
	base: command === 'build' ? './' : '/',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		target: 'ES6',
		assetsInlineLimit: 10_000_000,
		rollupOptions: {
			input: path.resolve(__dirname, 'docs-components/index.html'),
			output: {
				entryFileNames: 'index.js',
				chunkFileNames: '[name].js',
				assetFileNames: '[name][extname]',
			},
		},
	},
}))
