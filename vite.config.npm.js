const path = require('path')
const react = require('@vitejs/plugin-react')
const {defineConfig} = require('vite')
const {replaceAzureDevOpsFluentIconCSS, stripLegacyAzureDevOpsMediaQueries} = require('./vite.azure-devops')

module.exports = defineConfig({
	plugins: [replaceAzureDevOpsFluentIconCSS(), stripLegacyAzureDevOpsMediaQueries(), react()],
	build: {
		outDir: 'dist',
		emptyOutDir: false,
		lib: {
			entry: path.resolve(__dirname, 'components/Viewer.tsx'),
			name: 'SARIFViewer',
			formats: ['umd', 'es'],
			fileName: format => format === 'es' ? 'index.mjs' : 'index.js',
			cssFileName: 'sarif-web-component',
		},
		rollupOptions: {
			external: ['react', 'react-dom'],
			output: {
				globals: {
					react: 'React',
					'react-dom': 'ReactDOM',
				},
			},
		},
	},
})
