// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'react-dom'
jest.mock('react-dom')

import { Run } from 'sarif'
import { RunStore } from './RunStore'
import { Viewer } from './Viewer'

import { MobxFilter } from './FilterBar'
import {observable} from 'mobx'
jest.mock('./FilterBar')

it('does not explode', () => { // Bare bones perf is 0.2s
	const run = {
		tool: { driver: { name: "Sample Tool" } },
		results: [{
			message: { text: 'Message 1' },
		}],
	} as unknown as Run

	const runStore = new RunStore(run, 0, new MobxFilter())
	expect(runStore.columns.map(column => column.id)).toEqual(['Path', 'Details', 'Level', 'Kind'])
})

it('uses selected nested result fields as columns', () => {
	const selected = observable.box(['Path', 'properties.audit.selection.status'])
	const run = {
		tool: {driver: {name: 'Sample Tool'}},
		results: [{message: {text: 'Finding'}, properties: {audit: {selection: {status: 'reviewed'}}}}],
	} as unknown as Run
	const runStore = new RunStore(run, 0, new MobxFilter(), undefined, undefined, undefined, undefined, selected)

	expect(runStore.columns.map(column => column.id)).toEqual(['Path', 'properties.audit.selection.status'])
	expect(runStore.columns[1].filterString(run.results[0])).toBe('reviewed')
})

it('handles multiple logs', () => {
	const viewer = new Viewer({})
	
})
