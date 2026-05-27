# Publishing

## Current Publish Surface

- Source repository: GitHub
- Package surface: npm-compatible Node package
- CLI: `security-review-commons`
- CI: GitHub Actions on pushes and pull requests

## What "Published" Means In This Phase

1. The repository is public and pushable.
2. The package has clear exports and a working CLI.
3. CI verifies lint and tests.
4. The docs explain current guarantees and limitations honestly.
5. The package has enough rule coverage that external users can evaluate real findings instead of only toy examples.

## Not Yet Done

- npm registry publish
- OpenCode runtime fixture tests
- model-backed deeper agentic review
- AST or Semgrep integration
- release automation beyond plain GitHub source publishing

## Current Deterministic Coverage

- application code sinks and secret patterns
- GitHub Actions trust-boundary and privilege-drift checks
- Docker, Kubernetes, and Terraform hardening checks
- dependency selector governance in `package.json`

## Verification Artifacts

The CI workflow now publishes:

- a sample SARIF artifact
- a Markdown summary artifact
- a corpus report artifact tied to the baseline fixture set
