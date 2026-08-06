module.exports = {
	resolve: {
		extensions: ['.js', '.ts', '.tsx'] // .js is necessary for transitive imports
	},
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
			{ test: /\.woff$/, type: 'asset/inline' },
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
