const path = require('path')
const common = require('./webpack.config.common')

module.exports = {
	...common,
	mode: 'development',
	entry: './index.tsx',
	output: {
		path: path.join(__dirname, 'dist'),
		filename: 'index.js',
	},
	devServer : {
		devMiddleware: {
			publicPath: '/dist/',
			stats: 'none',
		},
		static: {
			directory: __dirname,
		},
	},
}
