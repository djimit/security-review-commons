# Release 0.2.0

## Source Tag

- package version: `0.2.0`
- source tag: `v0.2.0`
- release URL: `https://github.com/djimit/security-review-commons/releases/tag/v0.2.0`
- workflow run: `26606838384`
- published at: `2026-05-28T22:48:54Z`

## What This Release Now Proves

- **captured-live** packaged-plugin runtime fixture provenance for all 4 supported events:
  - `PostToolUse.Write`
  - `PreToolUse.Bash.git-commit`
  - `PreToolUse.Bash.git-push`
  - `Stop`
- **captured-live** OpenCode runtime fixture provenance for all 5 supported events:
  - `file.edited`
  - `session.diff`
  - `session.idle`
  - `tool.execute.before.git-commit`
  - `tool.execute.before.git-push`
- field shapes verified through live capture, including the `args` top-level field discovered in `tool.execute.before` events
- benchmark output now carries an explicit external comparator sidecar instead of implying parity from self-benchmark results alone
- source-release automation was exercised successfully and attached:
  - `security-review-commons-0.2.0.tgz`
  - `benchmark-baseline.json`
  - `external-baseline.json`
  - `runtime-fixtures.json`
- npm publication did not run from the source-release path

## What This Release Does Not Yet Prove

- no external comparator run has been verified; every comparator case remains explicitly unresolved
- no npm publication is proven in this local state

## Publication Decision

- npm publication decision: `blocked`
- rationale: manual publish attempts for `v0.2.0` on 2026-05-30 progressed from missing-token failure (`ENEEDAUTH`) to npm 2FA-policy failure (`E403`) and then to npm registry ownership or availability failure (`E404`) for the unscoped package name `security-review-commons`

## Release Follow-up

- npm publication for `v0.2.0` remains blocked because the tag still carries the unscoped package name
- future npm publication should use a new source release whose tag contains the scoped package identity `@djimit/security-review-commons`
