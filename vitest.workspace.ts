import { defineWorkspace } from 'vitest/config'

// I couldn't seem to get Vitest to run both regular test and types checks in a single test. So I created two workspaces, one for each.
export default defineWorkspace([
	{
		test: {
			name: 'Test option object',
		},
	},
	{
		test: {
			name: 'Test type object',
			typecheck: {
				enabled: true,
				include: ['**/src/**/*.test.ts'],
			},
		},
	},
])
