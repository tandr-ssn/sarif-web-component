
[![npm version](https://img.shields.io/npm/v/@microsoft/sarif-web-component.svg?style=flat)](https://www.npmjs.com/package/@microsoft/sarif-web-component)

# SARIF Web Component

A React-based component for viewing [SARIF](https://www.sarif.info) files. [Try it out](https://microsoft.github.io/sarif-web-component/).

## Usage

```
npm install @microsoft/sarif-web-component
```

```js
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {Viewer} from '@microsoft/sarif-web-component'

ReactDOM.render(<Viewer logs={arrayOfLogs} />, document.body.firstChild)
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

The Fields menu controls the result-table columns. Path, Details, Level, and Kind are selected by default. Other scalar SARIF values are shown in a searchable tree and may be selected at any depth, for example `properties.audit.selection.status`. Values found in arrays are combined into one column rather than exposed as numeric array indices.

To build and open the standalone viewer locally:

```
npm install
npm run docs
```

Then open `docs/index.html` directly in the browser. The build bundles React and the other runtime dependencies so the resulting page works offline. Generated `docs/index.js` is intentionally ignored and must not be committed.

## Publishing
Update the package version. Run workflow `Publish`. Make sure Repository secret `NODE_AUTH_TOKEN` exists.

## Publishing (Manual)
In your local clone of this repo, do the following. Double-check `package.json` `name` in case it was modified for development purposes.
```
git pull
npm install
npx webpack --config ./webpack.config.npm.js
npm login
npm publish
```

For a scoped non-paid accounts (such as for personal testing), publish would require: `npm publish --access public`.
For a dry-run publish: `npm publish --dry-run`. Careful: the typo `--dryrun` results in a real publish.

## Publishing (Local/Private)
As needed, run `git pull` and `npm install`. Then...
```
npx webpack --config ./webpack.config.npm.js
npm pack
```
Our convention is to move/keep the tarballs in the `packages` directory.

## Bundle Size Analysis
In `webpack.config.common.js` temporarily disable `stats: 'minimal'`.

```
npx webpack --profile --json > stats.json
npx webpack-bundle-analyzer stats.json
rm stats.json
```

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
