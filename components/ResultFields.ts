// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {Log, Result} from 'sarif'

export const DEFAULT_RESULT_FIELDS = ['Path', 'Details', 'Level', 'Kind']
export const BUILT_IN_RESULT_FIELDS = new Set([
	...DEFAULT_RESULT_FIELDS,
	'Rule', 'Actions', 'Baseline', 'Bug', 'Age', 'First Observed',
])

function capitalize(value: string): string {
	return value ? value[0].toUpperCase() + value.slice(1) : value
}

/** Returns readable shortest-unique-suffix labels while leaving built-in names unchanged. */
export function getResultFieldDisplayNames(paths: string[]): Map<string, string> {
	return new Map(paths.map(path => {
		if (BUILT_IN_RESULT_FIELDS.has(path)) return [path, path]
		const segments = path.split('.')
		let suffix = path
		for (let length = 1; length <= segments.length; length++) {
			const candidate = segments.slice(-length).join('.')
			const normalized = candidate.toLowerCase()
			const conflicts = paths.some(other => other !== path && (
				other.toLowerCase() === normalized || other.toLowerCase().endsWith(`.${normalized}`)))
			if (!conflicts) {
				suffix = candidate
				break
			}
		}
		return [path, suffix.split('.').map(capitalize).join(' ')]
	}))
}

export interface ResultFieldNode {
	name: string
	path?: string
	children: ResultFieldNode[]
}

function collectLeafPaths(value: unknown, segments: string[], paths: Set<string>, ancestors: Set<unknown>, depth: number): void {
	if (value === undefined || value === null || depth > 12) return
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		if (segments.length) paths.add(segments.join('.'))
		return
	}
	if (typeof value !== 'object' || value instanceof Date || ancestors.has(value)) return

	const nextAncestors = new Set(ancestors).add(value)
	if (Array.isArray(value)) {
		value.forEach(item => collectLeafPaths(item, segments, paths, nextAncestors, depth + 1))
		return
	}
	Object.keys(value as object).forEach(key => {
		if (key === 'run' || key.startsWith('_')) return
		collectLeafPaths(value[key], [...segments, key], paths, nextAncestors, depth + 1)
	})
}

export function discoverResultFieldPaths(logs: Log[] | undefined): string[] {
	const paths = new Set<string>()
	logs?.forEach(log => log.runs?.forEach(run => run.results?.forEach(result => collectLeafPaths(result, [], paths, new Set(), 0))))
	return Array.from(paths)
		.filter(path => !['level', 'kind'].includes(path))
		.sort((left, right) => left.localeCompare(right))
}

export function buildResultFieldTree(paths: string[]): ResultFieldNode[] {
	const roots: ResultFieldNode[] = []
	paths.forEach(path => {
		let nodes = roots
		path.split('.').forEach((name, index, segments) => {
			let node = nodes.find(candidate => candidate.name === name)
			if (!node) {
				node = {name, children: []}
				nodes.push(node)
			}
			if (index === segments.length - 1) node.path = path
			nodes = node.children
		})
	})
	return roots
}

function valuesAtPath(value: unknown, segments: string[]): unknown[] {
	if (value === undefined || value === null) return []
	if (Array.isArray(value)) return value.flatMap(item => valuesAtPath(item, segments))
	if (!segments.length) return [value]
	if (typeof value !== 'object') return []
	return valuesAtPath(value[segments[0]], segments.slice(1))
}

export function getResultFieldValue(result: Result, path: string): string {
	const values = valuesAtPath(result, path.split('.'))
		.filter(value => value !== undefined && value !== null)
		.map(value => typeof value === 'object' ? JSON.stringify(value) : String(value))
	return Array.from(new Set(values)).join(', ')
}
