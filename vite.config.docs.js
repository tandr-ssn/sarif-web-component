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
	css: {
		transformer: 'postcss',
		lightningcss: {
			errorRecovery: true,
		},
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		target: 'es2022',
		rollupOptions: {
			input: path.resolve(__dirname, 'docs-components/index.html'),
			output: {
				manualChunks(id) {
					if (id.includes('/node_modules/')) {
						return 'vendor'
					}
					return null
				},
				entryFileNames: 'scripts/[name]-[hash].js',
				chunkFileNames: 'scripts/[name]-[hash].js',
				assetFileNames: 'assets/[name]-[hash][extname]',
			},
		},
	},
}))
