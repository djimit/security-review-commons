# Security Review Commons

Portable, auditable code-security review core with thin adapters for OpenCode and Codex.

## Status

This repository implements a phase-4 local foundation with audit-as-assurance-mode:

- shared finding schema v2 with `info` severity, `detectionMethod`, `falsePositiveRisk`, `remediationEffort`, `complianceMapping`, and `evidence` fields
- deterministic per-edit warnings, background diff review, and checkpoint review
- repository-wide audit mode (pattern scanner + entropy scanner) with SARIF, summary, markdown, and compliance report output
- baseline mode for delta comparison (new/resolved/unchanged findings)
- compliance mapping to BIO2, NORA, ISO 27001, NIST CSF, and OWASP Top 10
- suppression governance with expiry, ownership, path scoping, and repository-scoped audit suppressions
- JSONL audit logging
- a runnable CLI with `review`, `audit`, and `baseline` subcommands
- OpenCode and Codex adapters
- CI for lint and tests (208 tests passing)

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

- `src/core/` shared review logic (review, audit, baseline, entropy scanner, compliance)
- `src/adapters/opencode/` OpenCode integration scaffold
- `src/adapters/codex/` Codex integration scaffold
- `.claude-plugin/`, `hooks/`, `bin/` host plugin packaging
- `.github/workflows/` CI
- `schemas/` JSON Schemas (finding v2, config)
- `examples/` sample additive policy and custom patterns
- `docs/` architecture, parity spec, threat model
- `tests/` node:test coverage (208 tests)
- `tests/corpus/audit/` audit mode fixture files

## Usage

### Review Mode (default)

```bash
node ./src/cli.js --diff-file <file> --changed-files <paths> --format sarif
```

### Audit Mode

Repository-wide security audit with pattern and entropy scanning:

```bash
# Full audit (JSON output)
node ./src/cli.js audit --repo-root .

# Audit with compliance mapping (markdown)
node ./src/cli.js audit --format compliance-markdown --repo-root .

# Audit with compliance mapping (JSON)
node ./src/cli.js audit --format compliance-json --repo-root .

# Audit including git history
node ./src/cli.js audit --include-history --repo-root .

# Legacy flag (deprecated, use subcommand instead)
node ./src/cli.js --audit --format summary
```

Audit output formats:

| Format | Flag | Description |
|--------|------|-------------|
| JSON | `--format json` | Full findings with metadata (default) |
| Summary | `--format summary` | Severity counts |
| Markdown | `--format markdown` | Human-readable report |
| SARIF | `--format sarif` | SARIF 2.1.0 for GitHub Advanced Security |
| Compliance Markdown | `--format compliance-markdown` | Findings grouped by framework and control |
| Compliance JSON | `--format compliance-json` | Structured compliance report |

### Baseline Mode

Create and compare against a security baseline:

```bash
# Write a baseline snapshot
node ./src/cli.js baseline --write-baseline --repo-root .

# Audit against a baseline (exit 1 for new critical/high findings, exit 2 for missing baseline)
node ./src/cli.js audit --baseline .security-baseline.json --repo-root .
```

### Entropy Scanner

The audit mode automatically runs entropy scanning alongside pattern matching. High-entropy strings (>4.5 bits/char by default) that don't match known secret prefixes are flagged with `detectionMethod: "entropy"` and elevated `falsePositiveRisk` in test directories.

Configure via `security-review.config.json`:

```json
{
  "scanners": {
    "entropy": true,
    "entropyThreshold": 4.5
  }
}
```

### Compliance Mapping

Each finding maps to regulatory frameworks: BIO2, NORA, ISO 27001, NIST CSF, OWASP Top 10. Filter by profile:

```json
{
  "compliance": {
    "profiles": ["BIO2", "NORA"],
    "evidenceLevel": "detailed"
  }
}
```

### CLI Help

```bash
node ./src/cli.js --help
node ./src/cli.js audit --help
node ./src/cli.js baseline --help
```

Suppress false positives with owner, justification, and expiry:

```json
{
  "suppressions": [
    {
      "ruleId": "no-hardcoded-secrets",
      "pathRegex": "test/fixtures/.*",
      "owner": "security-team@example.com",
      "justification": "Test fixture mock secrets",
      "expiresOn": "2025-12-31",
      "scope": "file"
    }
  ]
}
```

Repository-scoped suppressions only apply in audit mode:

```json
{
  "ruleId": "no-internal-ips",
  "owner": "infra-team@example.com",
  "justification": "Accepted: internal monitoring endpoints",
  "expiresOn": "2025-12-31",
  "scope": "repository"
}
```

## Trust Boundaries

- Repository files are untrusted input.
- Plugin config and repo policy are untrusted until parsed and validated.
- Tool and MCP output are untrusted.
- Model output, when added in later slices, must be treated as advisory and verified.
- Suppressions are allowed only with explicit owner, justification, and optional expiry.

## Current Limitations

- OpenCode payload normalization and packaged-plugin hook parsing are both backed by captured-live fixtures for the declared support matrix, but new host event variants still require scrubbed live capture.
- Guidance files are loaded additively from user, project, and repo-local scopes with explicit precedence; only additive guidance, patterns, and suppressions are supported in that path.
- Codex still does not claim native background hook or native git interception parity.
- Parser-backed semantic analysis covers JavaScript and a lightweight subset of TypeScript syntax, with explicit sink-scoped sanitizer suppression for a small built-in allowlist. It does not cover full TS-only constructs, decorators, or type-aware flow analysis.
- Checkpoint review expands one hop of local JS/TS imports plus bounded adjacent auth/config/router/middleware context, but does not attempt full inter-file taint tracking.
- Command-based turn review depends on an external reviewer executable when enabled; no built-in provider client ships in this slice.
- Entropy scanner detects high-entropy strings but cannot distinguish secrets from encoded data, hashes, or test fixtures — results have `falsePositiveRisk` elevated in test directories but still require manual review. URLs, UUIDs, SHA hashes, dotted config paths, and JSON keys are automatically excluded.
- Baseline mode compares by `(ruleId, file)` identity with line-delta fuzzy matching (`≤5` lines). Findings moving more than 5 lines are classified as `shifted` rather than `new+resolved`.
- Compliance mapping covers BIO2, NORA, ISO 27001, NIST CSF 2.0, and OWASP Top 10 (2021) across all 23 finding categories; EU AI Act and AVG/GDPR mappings are partial and advisory only.
- AST scanner backend is defined in the scanner registry (`scanner: "ast"`) but not yet implemented. The existing `js-semantic.js` parser covers JS/TS flow analysis in review mode and is not wired as an audit scanner. This is scoped for a future phase.
- Source releases are tag-driven; npm publish requires an explicit manual workflow dispatch plus `NPM_TOKEN`.

## Current Rule Coverage

Review mode (per-edit and diff):
- application sinks: command injection, eval-like execution, unsafe YAML loading, SSRF, path traversal, hardcoded secrets, open redirect, DOM HTML injection, auth-bypass flags and disabled authz config, direct object lookups from request identifiers and helper lookups by request ID, server-side template rendering from untrusted input, Python `pickle`, `torch.load`, `subprocess` with `shell=True`, `os.system`, `os.popen`, and `subprocess.getoutput` or `getstatusoutput`
- parser-backed JS/TS semantic flow checks: request-derived values into `exec`, `eval`, `fetch`, redirect targets, and `path.join/resolve`
- conservative sanitizer-aware suppression for explicit wrappers like `validateUrl`, `assertAllowedUrl`, and `sanitizeRelativePath`
- CI and workflow drift: `pull_request_target`, `permissions: write-all`, `curl | sh`
- container and IaC drift: Docker root runtime, Kubernetes privileged/root execution, Terraform public SSH ingress
- dependency governance: `latest`, `*`, and `x` package selectors in `package.json`

Audit mode (repository-wide):
- all review-mode rules applied to every tracked file
- 18 additional audit patterns: hardcoded credentials (AWS, Azure, GCP, generic API keys), internal IP disclosure, weak TLS, HTTP in production, debug flags, CORS misconfiguration, missing HSTS, SQL injection, missing input validation, insecure file uploads, exposed .env files, wildcard CORS, missing security headers
- Shannon entropy scanner for high-entropy strings (>4.5 bits/char) that don't match known prefix patterns, with deduplication against pattern findings
- compliance mapping to BIO2, NORA, ISO 27001, NIST CSF 2.0, and OWASP Top 10 for all 47 rules
- baseline delta comparison with `new`, `resolved`, `unchanged` classification

## Verification Harness

- `tests/corpus/basic.json` defines a baseline corpus of representative fixtures and expected rule IDs
- `npm run corpus` validates that the published rule set still catches that baseline and fails on corpus mismatches
- corpus reports now include benchmark-style pass summaries by review mode, layer, and expected rule coverage
- `benchmarks/manifest.json` and `npm run benchmark` generate a comparative-ready baseline report with hits, misses, false positives, and unresolved external gaps backed by a checked-in comparator sidecar
- CI uploads SARIF, a Markdown summary, and a corpus report as build artifacts
- `tests/config.test.js` verifies additive guidance-file precedence and explicit config merging

## CI Gate Usage

- `node ./src/cli.js review --diff-file <file> --changed-files <paths> --fail-on-severity high`
  exits non-zero when a finding at or above `high` is present (legacy mode: omit `review`)
- `node ./src/cli.js audit --repo-root . --fail-on-severity high`
  exits non-zero when an audit finding at or above `high` is present
- `node ./src/cli.js audit --baseline .security-baseline.json --repo-root .`
  exits 1 for new critical/high findings, 2 for missing baseline file
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
