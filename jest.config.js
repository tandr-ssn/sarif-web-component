module.exports = {
	// 10x perf improvement, see:
	// https://github.com/kulshekhar/ts-jest/issues/1044
	// Consider ts-jest isolatedModules for more perf.
	maxWorkers: 1,

	testEnvironment: 'jsdom',
	setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
	moduleNameMapper: {
		'\\.(png|s?css)$': 'identity-obj-proxy'
	},
	transform: {
		'^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
		'^.+\\.js?$': 'babel-jest',
	},
	transformIgnorePatterns: [
		'node_modules/(?!azure-devops-ui)/'
	],
	testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
}
