# Release 0.2.0

## Source Tag

- package version: `0.2.0`
- source tag: `v0.2.0`
- release URL: `https://github.com/djimit/security-review-commons/releases/tag/v0.2.0`
- workflow run: `26606838384`
- published at: `2026-05-28T22:48:54Z`

## What This Release Now Proves

- synthetic replay coverage now spans the declared packaged-plugin matrix:
  - `PostToolUse.Write`
  - `PreToolUse.Bash.git-commit`
  - `PreToolUse.Bash.git-push`
  - `Stop`
- synthetic replay coverage now spans the declared OpenCode matrix:
  - `file.edited`
  - `session.diff`
  - `session.idle`
  - `tool.execute.before.git-commit`
  - `tool.execute.before.git-push`
- benchmark output now carries an explicit external comparator sidecar instead of implying parity from self-benchmark results alone
- source-release automation was exercised successfully and attached:
  - `security-review-commons-0.2.0.tgz`
  - `benchmark-baseline.json`
  - `external-baseline.json`
  - `runtime-fixtures.json`
- npm publication did not run from the source-release path

## What This Release Does Not Yet Prove

- no checked-in live host-captured runtime payloads are included yet
- no external comparator run has been verified; every comparator case remains explicitly unresolved
- no npm publication is proven in this local state

## Publication Decision

- npm publication decision: `defer`
- rationale: the local evidence bar is stronger, but live runtime captures and verified external comparator runs are still missing

## Release Follow-up

- the GitHub workflow emitted a Node.js 20 deprecation warning for `actions/checkout@v4`, `actions/setup-node@v4`, and `softprops/action-gh-release@v2`
- this does not invalidate the successful `v0.2.0` release, but the workflow should be updated before the runtime cutoff window closes
