# Release 0.2.0

## Intended Source Tag

- package version: `0.2.0`
- intended source tag: `v0.2.0`

## What This Release Proves Locally

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
- source-release automation now attaches the tarball, benchmark baseline, comparator sidecar, and runtime-fixture provenance without attempting npm publication

## What This Release Does Not Yet Prove

- no checked-in live host-captured runtime payloads are included yet
- no external comparator run has been verified; every comparator case remains explicitly unresolved
- no GitHub tag or GitHub release workflow execution is proven in this local state
- no npm publication is proven in this local state

## Publication Decision

- npm publication decision: `defer`
- rationale: the local evidence bar is stronger, but live runtime captures and verified external comparator runs are still missing
