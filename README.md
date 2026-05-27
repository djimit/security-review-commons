# Security Review Commons

Portable, auditable code-security review core with thin adapters for OpenCode and Codex.

## Status

This repository implements the first vertical slice:

- a shared finding schema and deterministic rule engine,
- additive policy and reminder loading,
- capped diff review,
- JSONL audit logging,
- suppression governance with expiry and ownership,
- SARIF emission,
- a runnable CLI,
- OpenCode hook mapping for documented events,
- a Codex adapter scaffold,
- deterministic coverage for CI, containers, Terraform, and dependency-governance drift,
- CI for lint and tests.

It does not claim security guarantees. It is a review assistant with explicit trust boundaries.

## Design Goals

- Match the public Anthropic `security-guidance` architecture:
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

Run the baseline corpus:

```bash
npm run corpus
```

## Trust Boundaries

- Repository files are untrusted input.
- Plugin config and repo policy are untrusted until parsed and validated.
- Tool and MCP output are untrusted.
- Model output, when added in later slices, must be treated as advisory and verified.
- Suppressions are allowed only with explicit owner, justification, and optional expiry.

## Current Limitations

- No live OpenCode payload-shape verification yet.
- No live Codex background hook parity yet.
- Parser-backed semantic analysis covers JavaScript and a lightweight subset of TypeScript syntax, with explicit sink-scoped sanitizer suppression for a small built-in allowlist. It still does not cover full TS-only constructs, decorators, or type-aware flow analysis.
- No Semgrep or deeper inter-file dataflow integration yet.
- npm publish requires `NPM_TOKEN` to be configured in GitHub Actions.

## Current Rule Coverage

- application sinks: command injection, eval-like execution, unsafe YAML loading, SSRF, path traversal, hardcoded secrets
- parser-backed JS/TS semantic flow checks: request-derived values into `exec`, `eval`, `fetch`, and `path.join/resolve`
- conservative sanitizer-aware suppression for explicit wrappers like `validateUrl`, `assertAllowedUrl`, and `sanitizeRelativePath`
- CI and workflow drift: `pull_request_target`, `permissions: write-all`, `curl | sh`
- container and IaC drift: Docker root runtime, Kubernetes privileged/root execution, Terraform public SSH ingress
- dependency governance: `latest`, `*`, and `x` package selectors in `package.json`

## Verification Harness

- `tests/corpus/basic.json` defines a baseline corpus of representative fixtures and expected rule IDs
- `npm run corpus` validates that the published rule set still catches that baseline and fails on corpus mismatches
- CI uploads SARIF, a Markdown summary, and a corpus report as build artifacts

## CI Gate Usage

- `node ./src/cli.js --diff-file <file> --changed-files <paths> --fail-on-severity high`
  exits non-zero when a finding at or above `high` is present
- `node ./src/cli.js --corpus ./tests/corpus/basic.json --strict-corpus`
  exits non-zero when any corpus case deviates from expected findings

## Release

- tag a release as `v<version>` to trigger `.github/workflows/release.yml`
- the workflow runs checks, creates an npm tarball, publishes a GitHub release, and publishes to npm only when `NPM_TOKEN` is configured
