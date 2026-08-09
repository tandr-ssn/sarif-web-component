import {Log} from 'sarif'
import {createLocalSourceFileReader, createSelectedFilesSourceFileReader, FileSystemDirectoryHandleLike, getCommonAbsoluteSourceRoot, getSourcePathFromRoot} from './LocalSourceFile'

class TestDirectory implements FileSystemDirectoryHandleLike {
	readonly directories = new Map<string, TestDirectory>()
	readonly files = new Map<string, string>()

	constructor(readonly name: string) { }

	getDirectoryHandle(name: string): Promise<TestDirectory> {
		const directory = this.directories.get(name)
		return directory ? Promise.resolve(directory) : Promise.reject(new Error(`Missing directory: ${name}`))
	}

	getFileHandle(name: string) {
		const text = this.files.get(name)
		return text === undefined
			? Promise.reject(new Error(`Missing file: ${name}`))
			: Promise.resolve({
				getFile: async () => ({ name, text: async () => text } as File),
			})
	}
}

function sourceTree(): TestDirectory {
	const root = new TestDirectory('repo')
	const src = new TestDirectory('src')
	src.files.set('file.ts', 'source text')
	root.directories.set('src', src)
	return root
}

function selectedFile(path: string, text: string): File {
	const file = new File([text], path.split('/').pop())
	Object.defineProperty(file, 'webkitRelativePath', { value: path })
	Object.defineProperty(file, 'text', { value: async () => text })
	return file
}

test('reads a relative artifact beneath the selected source root', async () => {
	const read = createLocalSourceFileReader(sourceTree())
	await expect(read({ uri: 'src/file.ts' }, {} as any)).resolves.toEqual({
		name: 'src/file.ts',
		text: 'source text',
	})
})

test('maps an absolute artifact path from the detected root', async () => {
	const read = createLocalSourceFileReader(sourceTree(), '/home/user/repo')
	await expect(read({ uri: 'file:///home/user/repo/src/file.ts' }, {} as any)).resolves.toEqual({
		name: 'src/file.ts',
		text: 'source text',
	})
})

test('maps an absolute artifact path from the selected ancestor folder name', async () => {
	const read = createLocalSourceFileReader(sourceTree(), '/home/user/repo/src')
	await expect(read({uri: '/home/user/repo/src/file.ts'}, {} as any)).resolves.toEqual({
		name: 'src/file.ts',
		text: 'source text',
	})
	await expect(read({uri: 'C:\\work\\REPO\\src\\file.ts'}, {} as any)).resolves.toEqual({
		name: 'src/file.ts',
		text: 'source text',
	})
})

test('maps an absolute artifact after selecting its immediate source folder', async () => {
	const src = new TestDirectory('src')
	src.files.set('file.ts', 'source text')
	const read = createLocalSourceFileReader(src, '/home/user/repo')
	await expect(read({uri: '/home/user/repo/src/file.ts'}, {} as any)).resolves.toEqual({
		name: 'file.ts',
		text: 'source text',
	})
})

test('reads relative and absolute artifacts from a cross-browser folder selection', async () => {
	const files = [selectedFile('repo/src/file.ts', 'source text')]
	const read = createSelectedFilesSourceFileReader(files, '/home/user/repo')

	await expect(read({ uri: 'src/file.ts' }, {} as any)).resolves.toEqual({
		name: 'src/file.ts',
		text: 'source text',
	})
	await expect(read({ uri: 'file:///home/user/repo/src/file.ts' }, {} as any)).resolves.toEqual({
		name: 'src/file.ts',
		text: 'source text',
	})
	const readWithDeepDetectedRoot = createSelectedFilesSourceFileReader(files, '/home/user/repo/src')
	await expect(readWithDeepDetectedRoot({uri: '/home/user/repo/src/file.ts'}, {} as any)).resolves.toEqual({
		name: 'src/file.ts',
		text: 'source text',
	})
	await expect(read({ uri: '../secret.txt' }, {} as any)).resolves.toBeUndefined()
})

test('rejects paths outside the selected source root', async () => {
	const read = createLocalSourceFileReader(sourceTree())
	await expect(read({ uri: '../secret.txt' }, {} as any)).resolves.toBeUndefined()
	await expect(read({ uri: 'https://example.test/file.ts' }, {} as any)).resolves.toBeUndefined()
})

test('displays artifact paths from the selected root name', () => {
	expect(getSourcePathFromRoot('/home/user/calgary/src/file.ts', 'calgary', '/home/user/calgary'))
		.toBe('calgary/src/file.ts')
	expect(getSourcePathFromRoot('/home/user/calgary/src/file.ts', 'src', '/home/user/calgary'))
		.toBe('src/file.ts')
	expect(getSourcePathFromRoot('/home/user/calgary/src/file.ts', 'edmonton', '/home/user/calgary'))
		.toBe('edmonton/src/file.ts')
	expect(getSourcePathFromRoot('src/file.ts', 'calgary')).toBe('calgary/src/file.ts')
	expect(getSourcePathFromRoot('calgary/src/file.ts', 'calgary')).toBe('calgary/src/file.ts')
	expect(getSourcePathFromRoot('../secret.ts', 'calgary')).toBe('../secret.ts')
	expect(getSourcePathFromRoot('https://example.test/file.ts', 'calgary')).toBe('https://example.test/file.ts')
})

test('finds the common absolute source root in findings and traces', () => {
	const run: any = {
		tool: { driver: { name: 'test' } },
		results: [{
			message: { text: 'test' },
			locations: [
				{ physicalLocation: { artifactLocation: { uri: '/repo/src/finding.ts' } } },
				{ physicalLocation: { artifactLocation: { uri: '/repo/lib/other.ts' } } },
			],
			stacks: [{ frames: [{ location: { physicalLocation: { artifactLocation: { uri: '/usr/lib/external.ts' } } } }] }],
			codeFlows: [{ threadFlows: [{ locations: [{ index: 0 }] }] }],
		}],
		threadFlowLocations: [{ location: { physicalLocation: { artifactLocation: { uri: '/repo/app/entry.ts' } } } }],
	}
	const log = { version: '2.1.0', runs: [run] } as Log
	expect(getCommonAbsoluteSourceRoot([log])).toBe('/repo')
})
