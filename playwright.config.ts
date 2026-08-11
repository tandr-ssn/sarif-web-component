import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	retries: 0,
	reporter: 'list',
	use: {
		...devices['Desktop Chrome'],
		headless: true,
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
})
