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

- OpenCode runtime fixture tests
- model-backed deeper agentic review
- AST or Semgrep integration
- npm publish still depends on `NPM_TOKEN` being configured in repository secrets

## Current Deterministic Coverage

- application code sinks and secret patterns
- GitHub Actions trust-boundary and privilege-drift checks
- Docker, Kubernetes, and Terraform hardening checks
- dependency selector governance in `package.json`
- parser-backed JS/TS request-to-sink semantic checks for a narrow set of execution, fetch, and path-construction sinks

## Verification Artifacts

The CI workflow now publishes:

- a sample SARIF artifact
- a Markdown summary artifact
- a corpus report artifact tied to the baseline fixture set
- a benchmark script and baseline result artifact that record current local hits, misses, false positives, and unresolved comparative gaps
- runtime fixture provenance and capture tooling for synthetic versus scrubbed host payloads

## Release Workflow

- `.github/workflows/release.yml` triggers on tags matching `v*`
- it runs checks, creates an npm tarball, attaches it to a GitHub release, and publishes to npm only if `NPM_TOKEN` is present
- this keeps release automation honest: the repo is release-ready, but secret setup remains an explicit operational step
