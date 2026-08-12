import { Region, Run } from 'sarif'

function joinUrl(...parts: string[]): string {
	return parts.map((part, index) => index ? part.replace(/^\/+|\/+$/g, '') : part.replace(/\/+$/g, '')).join('/')
}

function getHostname(url: string | undefined): string | undefined {
	if (!url) return undefined
	try {
		return new URL(url).hostname
	} catch (_) {
		return undefined
	}
}

function isHostOrSubdomain(hostname: string, domain: string): boolean {
	return hostname === domain || hostname.endsWith(`.${domain}`)
}

function normalizeArtifactPath(uri: string): string {
	return `/${uri.replace(/\\/g, '/').replace(/^\/+/, '')}`
}

export function getRepoUri(uri: string | undefined, run: Run, region?: Region | undefined): string | undefined {
	if (!uri) return undefined

	const versionControlDetails = run.versionControlProvenance?.[0]
	if (!versionControlDetails) return undefined // Required.

	const { repositoryUri, revisionId } = versionControlDetails
	const hostname = getHostname(repositoryUri)
	if (!hostname) return undefined // Required.

	const artifactPath = normalizeArtifactPath(uri)
	if (isHostOrSubdomain(hostname, 'azure.com') || isHostOrSubdomain(hostname, 'visualstudio.com')) {
		// Examples:
		// https://dev.azure.com/microsoft/sarif-web-component/_git/sarif-web-component?path=%2F.gitignore
		// https://dev.azure.com/microsoft/sarif-web-component/_git/sarif-web-component?path=%2F.gitignore&version=GCd14c42f18766159a7ef6fbb8858ab5ad4f0b532a
		const repoUrl = new URL(repositoryUri)
		repoUrl.searchParams.set('path', artifactPath)
		if (revisionId) repoUrl.searchParams.set('version', `GC${revisionId}`)
		if (region?.startLine) { // lines and columns are 1-based, so it is safe to to use simple truthy checks.
			// First three params required even in the most basic case (highlight a single line).
			// If there is no endColumn, we +1 the lineEnd to select the entire line.
			repoUrl.searchParams.set('line', `${region.startLine}`)
			repoUrl.searchParams.set('lineEnd', `${region.endLine ?? (region.startLine + (region.endColumn ? 0 : 1))}`)
			repoUrl.searchParams.set('lineStartColumn', `${region.startColumn ?? 1}`)
			if (region.endColumn) repoUrl.searchParams.set('lineEndColumn', `${region.endColumn}`)
		}
		return repoUrl.toString()
	}

	if (isHostOrSubdomain(hostname, 'github.com')) {
		// Examples:
		// https://github.com/microsoft/sarif-web-component/blob/main/.gitignore
		// https://github.com/microsoft/sarif-web-component/blob/d14c42f18766159a7ef6fbb8858ab5ad4f0b532a/.gitignore
		// https://github.com/microsoft/sarif-web-component/blob/d14c42f18766159a7ef6fbb8858ab5ad4f0b532a/.gitignore#L1
		// Note: path-browserify's path.join does does not preserve authority slashes
		// (ex: https://github.com becomes https:/github.com). Thus using url-join.
		const repositoryUrl = new URL(repositoryUri)
		repositoryUrl.search = ''
		repositoryUrl.hash = ''
		repositoryUrl.pathname = joinUrl(repositoryUrl.pathname, 'blob', revisionId ?? 'main', artifactPath)
		let repoUri = repositoryUrl.toString()
		if (region?.startLine) { // `startLine` is 1-based.
			repoUri += `#L${region!.startLine}`
		}
		return repoUri
	}

	return undefined // Unsupported host.
}
