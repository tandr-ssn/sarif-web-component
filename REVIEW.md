# SARIF Viewer Review and Improvement Plan

This document records the August 2026 read-only review and tracks the resulting work.

## Priority 1: security and correctness

- [x] Stop interpolating SARIF-controlled names into source-viewer HTML identifiers; generate opaque IDs and escape every HTML attribute.
- [x] Centralize external URL validation, permit only intended schemes, and consistently use `noopener noreferrer` for new-window links.
- [x] Remove forever-cached run stores and dispose every MobX reaction created by viewer components and stores.
- [x] Rebuild run stores when behavior-changing React props change; do not cache computed values derived from non-observable props.
- [x] Stop mutating caller-owned SARIF documents. Keep indexes, rule links, actions, age data, and other derived state in viewer-owned models or metadata.
- [x] Fix result action indexes so Visual Studio and VS Code links for a finding use the same result index, and URL-encode all query parameters.
- [x] Avoid storing raw paths and messages in finding-triage keys, and prevent stale aliases from leaving ghost hidden states.
- [x] Require every keyword term to match somewhere in a finding's driver, rule, or selected columns, and never mutate caller filter arrays.

## Priority 2: user experience

- [x] Make the filter toolbar responsive: search on the first row and actions on the second when space is limited.
- [x] Clarify finding and group visibility actions, include visible/hidden/all counts, and provide an accessible undo after hiding.
- [x] Reduce column-header menu noise while keeping active filters obvious and keyboard-accessible.
- [x] Add a selected-columns area with ordering, removal, and restore-defaults controls.
- [ ] Keep fit-all readable with many columns and preserve usable horizontal scrolling when fit-all is disabled.
- [x] Ensure shortened source paths are also used in tooltips so local home-directory prefixes are not exposed.
- [ ] Improve narrow-screen, keyboard, zoom, and tooltip accessibility behavior.

## Priority 3: loading, release, and maintenance

- [x] Show useful file-read, JSON-parse, and invalid-SARIF errors; document local retention and provide a close-and-forget action.
- [ ] Add CI using the supported Node version, clean installation, type checking, unit tests, and package dry-run before publishing.
- [ ] Add focused tests for report replacement, prop changes, hostile paths and URLs, lifecycle cleanup, narrow viewports, keyboard operation, and large synthetic reports.
- [ ] Remove confirmed dead code and dependencies, including the unused global `Array.prototype.sorted` extension.
- [ ] Split the source viewer into safer rendering, source resolution, and popup-controller units.
- [ ] Break Viewer import cycles and incrementally strengthen TypeScript settings.
- [ ] Stage dependency modernization; avoid combining React, MobX, Markdown, and Azure DevOps UI migrations.
- [ ] Clarify fork ownership and publishing metadata in README, package metadata, and security guidance.

## Later opportunities

- [ ] Add a modern ESM package entry while retaining the compatible UMD build.
- [ ] Re-evaluate disabled npm-bundle minification and remove unused production weight.
- [ ] Isolate Azure DevOps UI behind local primitives before considering replacement.
- [ ] Consider a finding-list and detail-pane layout for reports with many verbose columns.

The current self-contained offline HTML is approximately 1.2 MB and is not itself a priority. `npm audit` reported no known vulnerabilities at the time of this review.
