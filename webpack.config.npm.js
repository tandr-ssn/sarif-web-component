const common = require('./webpack.config.common')
const path = require('path')

const umd = {
	...common,
	mode: 'production',
	entry: {
		'dist': './components/Viewer.tsx',
	},
	optimization: {
		minimize: true,
	},
	output: {
		path: __dirname,
		filename: '[name]/index.js',
		libraryTarget: 'umd',
		globalObject: 'this',
	},
	externals: {
		'react': {
			commonjs: 'react',
			commonjs2: 'react',
			amd: 'React',
			root: 'React',
		},
		'react-dom': {
			commonjs: 'react-dom',
			commonjs2: 'react-dom',
			amd: 'ReactDOM',
			root: 'ReactDOM',
		}  
	} 
}

const esm = {
	...common,
	mode: 'production',
	entry: './components/Viewer.tsx',
	optimization: {minimize: true},
	experiments: {outputModule: true},
	externalsType: 'module',
	externals: {
		react: 'react',
		'react-dom': 'react-dom',
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'index.mjs',
		library: {type: 'module'},
		module: true,
	},
}

module.exports = [umd, esm]
