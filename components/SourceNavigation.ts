import {PhysicalLocation, Result, Run} from 'sarif'
import {findingIdentityKeys} from './FindingTriage'
import {getResultSourceTrace} from './ResultSourceTrace'
import {SourceFindingNavigation, SourceNavigation, SourceTrace} from './SourceFile'
import {getArtifactLocation, sourceViewKey} from './SourceFileResolver'
import {stableSha256} from './StableHash'

function findingLabel(result: Result): string {
	const rule = result._rule
	return rule?.shortDescription?.text ?? rule?.name ?? result.ruleId ?? rule?.id ?? 'Finding'
}

function navigationTraces(result: Result): Array<SourceTrace | undefined> {
	const flowCount = result.codeFlows?.filter(flow => flow.threadFlows?.length).length ?? 0
	if (!flowCount) return [getResultSourceTrace(result)]
	return Array.from({length: flowCount}, (_, index) => getResultSourceTrace(result, index))
}

function fileKey(location: PhysicalLocation | undefined, run: Run): string | undefined {
	const artifact = getArtifactLocation(location, run)
	return artifact && sourceViewKey(artifact)
}

/** Builds the report-wide index used by reusable source-viewer tabs. */
export function buildSourceNavigation(runs: Run[]): SourceNavigation {
	const byFile = new Map<string, SourceFindingNavigation[]>()
	const byLocation = new WeakMap<object, SourceFindingNavigation>()
	const reportParts: unknown[] = []

	runs.forEach((run, runIndex) => {
		const results = run.results ?? []
		reportParts.push([
			run.automationDetails?.guid ?? run.automationDetails?.id ?? '',
			run.properties?.['logFileName'] ?? '',
			run.tool.driver.guid ?? run.tool.driver.name,
			run.versionControlProvenance?.[0]?.repositoryUri ?? '',
			results.map(result => findingIdentityKeys(result)[0]).sort(),
		])
		results.forEach(result => {
			const id = findingIdentityKeys(result)[0]
			const seenFiles = new Set<string>()
			const traces = navigationTraces(result)
			const primary = result.locations?.[0]?.physicalLocation
			traces.forEach(trace => {
				const locations = trace?.locations?.length ? trace.locations : [primary]
				locations.forEach(location => {
					const key = fileKey(location, run)
					if (!location || !key) return
					const existing = byFile.get(key)?.find(entry => entry.id === id)
					const entry = existing ?? {
						id,
						label: findingLabel(result),
						run,
						runIndex,
						location,
						trace,
					} as SourceFindingNavigation
					byLocation.set(location as object, entry)
					if (seenFiles.has(key) || existing) return
					seenFiles.add(key)
					const entries = byFile.get(key) ?? []
					entries.push(entry)
					byFile.set(key, entries)
				})
			})
		})
	})

	byFile.forEach(entries => entries.sort((left, right) =>
		(left.location.region?.startLine ?? 0) - (right.location.region?.startLine ?? 0)
		|| left.label.localeCompare(right.label)
		|| left.id.localeCompare(right.id)))
	return {
		reportId: stableSha256(JSON.stringify(reportParts)),
		byFile,
		byLocation,
	}
}
