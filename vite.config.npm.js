const path = require('path')
const react = require('@vitejs/plugin-react')
const {defineConfig} = require('vite')

module.exports = defineConfig({
	plugins: [react()],
	build: {
		outDir: 'dist',
		emptyOutDir: false,
		lib: {
			entry: path.resolve(__dirname, 'components/Viewer.tsx'),
			name: 'SARIFViewer',
			formats: ['umd', 'es'],
			fileName: format => format === 'es' ? 'index.mjs' : 'index.js',
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
