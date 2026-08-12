import {readFileSync} from 'fs'
import {resolve} from 'path'

const schema = JSON.parse(readFileSync(resolve(__dirname, '../schema/acah-sarif-properties.schema.json'), 'utf8'))

test('vendors the strict ACAH SARIF v4 contract', () => {
	expect(schema.$defs.runExtension.properties.formatVersion.const).toBe(4)
	expect(schema.$defs.runExtension.additionalProperties).toBe(false)
	expect(schema.$defs.ruleExtension.additionalProperties).toBe(false)
	expect(schema.$defs.resultExtension.additionalProperties).toBe(false)
	expect(schema.$defs.traceStepExtension.additionalProperties).toBe(false)
})

test('requires complete canonical claim, detector, and effect metadata', () => {
	expect(schema.$defs.canonicalClaim.required).toEqual(['id', 'vulnerabilityClass', 'reason'])
	expect(schema.$defs.detectorObservation.required).toEqual([
		'id', 'producer', 'ruleId', 'originalFingerprint', 'classification', 'message', 'codeFlowIndices',
	])
	expect(schema.$defs.effect.required).toEqual(['status', 'kind', 'reason'])
	expect(schema.$defs.effect.properties.status.enum).toEqual(['unresolved', 'modeled', 'confirmed'])
})

test('covers every supported native language and configured model type', () => {
	expect(Object.keys(schema.$defs.nativeAnalysis.properties)).toEqual(['csharp', 'go', 'java', 'php'])
	expect(schema.$defs.scanConfiguration.properties).toHaveProperty('sanitizers')
	expect(schema.$defs.scanConfiguration.properties).toHaveProperty('summaries')
})
