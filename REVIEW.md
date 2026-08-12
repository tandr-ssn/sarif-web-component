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
- [x] Keep fit-all readable with many columns and preserve usable horizontal scrolling when fit-all is disabled.
- [x] Ensure shortened source paths are also used in tooltips so local home-directory prefixes are not exposed.
- [x] Improve narrow-screen, keyboard, zoom, and tooltip accessibility behavior.

## Priority 3: loading, release, and maintenance

- [x] Show useful file-read, JSON-parse, and invalid-SARIF errors; document local retention and provide a close-and-forget action.
- [ ] Add CI using the supported Node version, clean installation, type checking, unit tests, and package dry-run before publishing when repository automation is wanted.
- [x] Add focused tests for report replacement, prop changes, hostile paths and URLs, lifecycle cleanup, narrow viewports, keyboard operation, and large synthetic reports.
- [x] Remove confirmed dead code and dependencies, including the unused global `Array.prototype.sorted` extension.
- [x] Split the source viewer into safer rendering, source resolution, and popup-controller units.
- [x] Break Viewer import cycles and incrementally strengthen TypeScript settings.
- [x] Stage dependency modernization; avoid combining React, MobX, Markdown, and Azure DevOps UI migrations.
- [x] Clarify fork ownership and publishing metadata in README, package metadata, and security guidance.

## Later opportunities

- [x] Add a modern ESM package entry while retaining the compatible UMD build.
- [x] Re-evaluate disabled npm-bundle minification and remove unused production weight.
- [x] Isolate Azure DevOps UI behind local primitives before considering replacement.
- [x] Evaluate a finding-list and detail-pane layout. Retain the current grouped tree/card layout for now: a second navigation model would complicate selection, clipboard, export, filtering, and responsive behavior; revisit only with a dedicated interaction design.

The current self-contained offline HTML is approximately 1.2 MB and is not itself a priority. `npm audit` reported no known vulnerabilities at the time of this review.
