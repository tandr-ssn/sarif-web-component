const webpack = require('webpack')
const path = require('path')

module.exports = {
	resolve: {
		extensions: ['.js', '.ts', '.tsx'] // .js is necessary for transitive imports
	},
	plugins: [
		// Azure DevOps UI 2.277 enables its 1.3 MB Fluent icon fonts by default.
		// The viewer deliberately retains the smaller embedded Fabric icon font.
		new webpack.NormalModuleReplacementPlugin(/^\.\/FluentIcons\.css$/, resource => {
			if (/azure-devops-ui[\\/]Components[\\/]Icon$/.test(resource.context)) {
				resource.request = path.join(__dirname, 'components/EmptyStyle.css')
			}
		}),
	],
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: {
					loader: 'ts-loader',
					options: { transpileOnly: true },
				},
				exclude: /node_modules/
			},
			{
				test: /\.s?css$/,
				use: ['style-loader', 'css-loader', 'sass-loader']
			},
			{ test: /\.png$/, type: 'asset/inline' },
			{ test: /\.woff2?$/, type: 'asset/inline' },
		]
	},
	performance: {
		// azure-devops-ui is the majority of the payload
		// and is needed on boot (thus cannot be lazy loaded).
		maxAssetSize: 820 * 1024,
		maxEntrypointSize: 820 * 1024,
	},
	stats: 'minimal', // If left on will disrupt `webpack --profile`.
}
