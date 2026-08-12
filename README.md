
[![npm version](https://img.shields.io/npm/v/@acah/sarif-web-component.svg?style=flat)](https://www.npmjs.com/package/@acah/sarif-web-component)

# SARIF Web Component

A React-based component for viewing [SARIF](https://www.sarif.info) files. This maintained fork extends Microsoft's original component with an offline standalone viewer, configurable fields and exports, local source navigation, and persistent finding visibility. [Try it out](https://tandr-ssn.github.io/sarif-web-component/).

## Usage

```
npm install @acah/sarif-web-component
```

```js
import * as React from 'react'
import {createRoot} from 'react-dom/client'
import {Viewer} from '@acah/sarif-web-component'

createRoot(document.body.firstChild).render(<Viewer logs={arrayOfLogs} />)
```
In the HTML page hosting this component, `<meta http-equiv="content-type" content="text/html; charset=utf-8">` is required to avoid text rendering issues.

### Offline source navigation

The standalone viewer can run without network access. Enable its local source-folder picker with:

```jsx
<Viewer logs={arrayOfLogs} showLocalSourcePicker />
```

The user must explicitly select the folder containing the source files referenced by SARIF. Relative artifact URIs are resolved beneath that folder. For absolute paths, the viewer displays the common source root detected in the results and asks the user to select the corresponding local folder. Browsers intentionally do not reveal the parent directory of a SARIF file selected with `<input type="file">`.

The viewer uses the File System Access API where available and a directory-selection input as a fallback. Hosts with their own filesystem integration can instead pass a `sourceFileReader` callback. Source embedded in `run.artifacts[].contents.text` continues to work without either option.

Call stacks in `result.stacks` and execution paths in `result.codeFlows` are displayed beneath each result; code-flow locations also display SARIF snippets when present. Their source locations use the same offline source reader. Opening a trace location highlights every readable entry from that trace in numbered colors; gutter arrows move between source files without leaving the opened tab. Clicking the result's Path uses its first code flow, or first call stack when no code flow is present, for the same navigation.

The opened source toolbar supports previous/next readable trace navigation (`[` and `]`), reports unavailable locations, and can copy the current path, path with line number, or the trace summary. Source reads are cached for the current reader and SARIF run. Supported C#, Go, Java, JavaScript/TypeScript, JSON, and XML-family files receive offline syntax coloring; other file types remain escaped plain text.

The Fields menu controls the result-table columns. Path, Details, Level, and Kind are selected by default. Other scalar SARIF values from each result and its associated rule are shown in a searchable tree and may be selected at any depth, for example `result.properties.acah.sink.selection.status`, `result.message.text`, or `rule.helpUri`. Values found in arrays are combined into one column rather than exposed as numeric array indices. Field and column tooltips show the full SARIF JSON path. The ordered selection is remembered in local storage across reloads and browser restarts; embedded viewers may provide `fieldSelectionStorageKey` to isolate their setting or set it to `false` to disable persistence.

Selected fields may be exported as plain-text CSV, raw-value CSV, TSV, a rendered HTML report, a rendered HTML table, plain text, or a readable Markdown report, so rule descriptions, advisory content, reference URLs, and occurrence-specific messages can be included. Export headings use the same readable, shortest-unique field names as the on-screen columns rather than raw JSON paths. Plain-text CSV and TSV convert Markdown headings, lists, links, code, and tables to readable text; raw-value CSV retains the producer's exact Markdown. Both HTML formats retain rendered formatting and safe links; the table format keeps every selected logical field as a separate column, including Path when it is embedded in Details on screen. On screen, `.markdown` fields are formatted automatically. `.text` fields containing common Markdown constructs such as fenced code, headings, lists, tables, links, or inline formatting are also formatted, while ordinary text preserves its line endings. Markdown report exports retain detected Markdown content instead of flattening it into spreadsheet cells.

Copying complete finding-table cells supplies spreadsheet-friendly TSV as `text/plain` and the rendered cells as an HTML table, allowing targets such as Excel to choose the representation they support. When Path is selected but displayed inside Details, it remains a separate logical clipboard column. A single Markdown-valued cell also supplies its original source as `text/markdown`. Partial text selections retain the browser's normal copy behavior.

ACAH SARIF format v4 receives additional offline presentation when `run.properties.acah.formatVersion` is `4`. The viewer shows each canonical verdict, stable claim ID, effect state, and every contributing detector from `properties.acah.detectedBy`. ACAH determines claim identity, merging, queue membership, and top-level section order; the viewer does not regroup those results. Trace roles and exact symbols drive source, propagation, boundary, and sink presentation. Potentially sensitive `valuePreview` data is never placed in automatic summaries or tooltips. The complete extension contract is published with the package as [`schema/acah-sarif-properties.schema.json`](schema/acah-sarif-properties.schema.json).

To build and open the standalone viewer locally, install Node.js 24 LTS or newer and npm, then run this from a fresh checkout:

```
npm ci --ignore-scripts
npm run build
```

`--ignore-scripts` prevents dependencies from running lifecycle scripts during installation; this project does not require them to build the standalone viewer.

Then open `dist/index.html` directly in the browser. Opening the repository's root `index.html` from the filesystem redirects there as a convenience; when served over HTTP, the root page remains the Vite development shell. The build bundles React and the other runtime dependencies so the resulting page works offline. Generated `dist/index.js` is intentionally ignored and must not be committed.

The offline demo keeps the opened SARIF and selected source-folder name in browser storage across page reloads. If session storage quota is insufficient, the report uses an IndexedDB fallback and can survive a browser restart. Source contents and directory handles are not persisted. Use **Close and forget** to remove the remembered report; after a reload, use **Reconnect source folder...** to grant local read access again.

## Publishing
Update the package version. When publishing automation is restored, it should perform a clean Node 24 install, typecheck, unit tests, package build, and package dry-run before publishing. Configure an npm publishing token only in that release environment.

## Publishing (Manual)
In your local clone of this repo, do the following. Double-check `package.json` `name` in case it was modified for development purposes.
```
git pull
npm ci --ignore-scripts
npm run typecheck
npm test -- --runInBand
npm run npm
npm pack --dry-run
npm login
npm publish
```

For a scoped non-paid accounts (such as for personal testing), publish would require: `npm publish --access public`.
For a dry-run publish: `npm publish --dry-run`. Careful: the typo `--dryrun` results in a real publish.

## Publishing (Local/Private)
As needed, run `git pull` and `npm ci --ignore-scripts`. Then...
```
npm run npm
npm pack
```
Our convention is to move/keep the tarballs in the `packages` directory.

## Bundle Size Analysis
Run `vite build` with output profiling from the Vite UI/bundler analyzer of your choice after updating `vite.config.docs.js` for your workflow.

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
