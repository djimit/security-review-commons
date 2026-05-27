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

Run the example deterministic review from Node:

```bash
node -e 'import { runDeterministicReview } from "./src/core/review.js"; import fs from "node:fs"; const diff = fs.readFileSync("./tests/fixtures/sample.diff","utf8"); const res = runDeterministicReview({ diff, changedFiles:["src/auth/login.js"] }); console.log(JSON.stringify(res, null, 2));'
```

Run the CLI and emit SARIF:

```bash
node ./src/cli.js --diff-file ./tests/fixtures/sample.diff --changed-files src/auth/login.js --format sarif
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
- No AST or Semgrep integration yet.
- No npm registry publish yet.
