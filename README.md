# Security Review Commons

Portable, auditable code-security review core with thin adapters for OpenCode and Codex.

## Status

This repository now implements a stronger phase-4 local foundation:

- a shared finding schema and deterministic rule engine,
- additive policy and reminder loading,
- capped diff review,
- async turn review with deterministic fallback and optional command-based model review,
- checkpoint review over full changed-file contents with bounded import and adjacent evidence context,
- JSONL audit logging,
- suppression governance with expiry and ownership,
- SARIF emission,
- a runnable CLI,
- OpenCode hook mapping with explicit payload normalizers for documented events,
- explicit Codex edit, turn, and checkpoint entrypoints,
- deterministic coverage for CI, containers, Terraform, dependency-governance drift, selected web sinks, Python deserialization hazards, and broader high-signal Python command-execution sinks,
- CI for lint and tests.

It does not claim security guarantees. It is a review assistant with explicit trust boundaries.

## Design Goals

- Preserve a three-layer review model:
  - deterministic per-edit warnings,
  - background end-of-turn diff review,
  - deeper commit and push review.
- Keep the real logic in a shared core.
- Support local-first operation.
- Keep repo policy additive only.
- Emit structured evidence.

## Repo Layout

- `src/core/` shared review logic
- `src/adapters/opencode/` OpenCode integration scaffold
- `src/adapters/codex/` Codex integration scaffold
- `.claude-plugin/`, `hooks/`, `bin/` host plugin packaging
- `.github/workflows/` CI
- `schemas/` JSON Schemas
- `examples/` sample additive policy and custom patterns
- `docs/` architecture, parity spec, threat model
- `tests/` node:test coverage

## Usage

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run check
```

Dry-run the published package contents:

```bash
npm run pack:dry-run
```

Run the example deterministic review from Node:

```bash
node -e 'import { runDeterministicReview } from "./src/core/review.js"; import fs from "node:fs"; const diff = fs.readFileSync("./tests/fixtures/sample.diff","utf8"); const res = runDeterministicReview({ diff, changedFiles:["src/auth/login.js"] }); console.log(JSON.stringify(res, null, 2));'
```

Run the CLI and emit SARIF:

```bash
node ./src/cli.js --diff-file ./tests/fixtures/sample.diff --changed-files src/auth/login.js --format sarif
```

Run checkpoint review against working tree files:

```bash
node ./src/cli.js --review-mode checkpoint --repo-root ./tests/fixtures/checkpoint-repo --changed-files-file ./tests/fixtures/checkpoint-changed-files.txt --layer commit
```

Run turn review with an optional configured reviewer:

```bash
node ./src/cli.js --review-mode turn --config ./tests/fixtures/turn-review.config.json --diff-file ./tests/fixtures/turn-review.diff --changed-files src/auth/flow.js --repo-root .
```

Run the baseline corpus:

```bash
npm run corpus
```

Run the comparative baseline benchmark harness:

```bash
npm run benchmark
```

Run the packaged plugin hook replay tests:

```bash
node --test tests/plugin-hooks.test.js
```

## Trust Boundaries

- Repository files are untrusted input.
- Plugin config and repo policy are untrusted until parsed and validated.
- Tool and MCP output are untrusted.
- Model output, when added in later slices, must be treated as advisory and verified.
- Suppressions are allowed only with explicit owner, justification, and optional expiry.

## Current Limitations

- OpenCode payload normalization and packaged-plugin hook parsing are both backed by captured-live fixtures for the declared support matrix, but any new host event variant still requires scrubbed live capture before it should be claimed as supported.
- Guidance files are now loaded additively from user, project, and repo-local scopes with explicit precedence, but only additive guidance, patterns, and suppressions are supported in that path.
- Codex still does not claim native background hook or native git interception parity.
- Parser-backed semantic analysis covers JavaScript and a lightweight subset of TypeScript syntax, with explicit sink-scoped sanitizer suppression for a small built-in allowlist. It still does not cover full TS-only constructs, decorators, or type-aware flow analysis.
- Checkpoint review now expands one hop of local JS/TS imports plus bounded adjacent auth/config/router/middleware context, but it still does not attempt full inter-file taint tracking.
- Command-based turn review depends on an external reviewer executable when enabled; no built-in provider client ships in this slice.
- Comparative benchmark output is now generated locally with an explicit comparator sidecar, but external comparator results are still recorded as unresolved until verified against a live baseline run.
- Source releases are tag-driven, but npm publish now requires an explicit manual workflow dispatch plus `NPM_TOKEN`, and the old unscoped package name proved non-publishable from the tested npm accounts.

## Current Rule Coverage

- application sinks: command injection, eval-like execution, unsafe YAML loading, SSRF, path traversal, hardcoded secrets, open redirect, DOM HTML injection, auth-bypass flags and disabled authz config, direct object lookups from request identifiers and helper lookups by request ID, server-side template rendering from untrusted input, Python `pickle`, `torch.load`, `subprocess` with `shell=True`, `os.system`, `os.popen`, and `subprocess.getoutput` or `getstatusoutput`
- parser-backed JS/TS semantic flow checks: request-derived values into `exec`, `eval`, `fetch`, redirect targets, and `path.join/resolve`
- conservative sanitizer-aware suppression for explicit wrappers like `validateUrl`, `assertAllowedUrl`, and `sanitizeRelativePath`
- CI and workflow drift: `pull_request_target`, `permissions: write-all`, `curl | sh`
- container and IaC drift: Docker root runtime, Kubernetes privileged/root execution, Terraform public SSH ingress
- dependency governance: `latest`, `*`, and `x` package selectors in `package.json`

## Verification Harness

- `tests/corpus/basic.json` defines a baseline corpus of representative fixtures and expected rule IDs
- `npm run corpus` validates that the published rule set still catches that baseline and fails on corpus mismatches
- corpus reports now include benchmark-style pass summaries by review mode, layer, and expected rule coverage
- `benchmarks/manifest.json` and `npm run benchmark` generate a comparative-ready baseline report with hits, misses, false positives, and unresolved external gaps backed by a checked-in comparator sidecar
- CI uploads SARIF, a Markdown summary, and a corpus report as build artifacts
- `tests/config.test.js` verifies additive guidance-file precedence and explicit config merging

## CI Gate Usage

- `node ./src/cli.js --diff-file <file> --changed-files <paths> --fail-on-severity high`
  exits non-zero when a finding at or above `high` is present
- `node ./src/cli.js --corpus ./tests/corpus/basic.json --strict-corpus`
  exits non-zero when any corpus case deviates from expected findings
- `node ./src/cli.js --debug --enabled-layers edit,commit,push --diff-file <file> --changed-files <paths>`
  emits metadata-only debug output on stderr and surfaces skipped-layer audit metadata when a layer is disabled

## Release

- tag a release as `v<version>` to trigger `.github/workflows/release.yml`
- the release workflow runs checks, creates an npm tarball, and publishes a GitHub source release with proof artifacts only
- publish to npm separately through `.github/workflows/publish-npm.yml` after an explicit operator confirmation
- see [docs/release-0.2.0.md](./docs/release-0.2.0.md) for the current release-truth snapshot and publication decision
- see [docs/plugin-packaging.md](./docs/plugin-packaging.md) for the current plugin surface and debug notes
