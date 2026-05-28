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

- checked-in live OpenCode or packaged-plugin runtime captures
- model-backed deeper agentic review
- AST or Semgrep integration
- npm publish still depends on `NPM_TOKEN` being configured in repository secrets, but it no longer runs from the tag-triggered source-release path

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
- a benchmark baseline result artifact that records current local hits, misses, false positives, and unresolved comparative gaps
- an external comparator sidecar artifact that records the explicit unresolved status for each benchmark case until a real baseline run is reviewed
- a runtime fixture provenance artifact that records which replay payloads are still synthetic versus captured-live

## Release Workflow

- `.github/workflows/release.yml` triggers on tags matching `v*`
- it runs checks, refreshes the benchmark baseline, creates an npm tarball, and attaches the tarball plus proof artifacts to a GitHub release
- `.github/workflows/publish-npm.yml` is a separate manual path that requires an explicit release tag and `confirm_publish=true`
- this keeps release automation honest: a source tag alone cannot publish to npm
