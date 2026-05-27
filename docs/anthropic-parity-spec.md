# Anthropic Parity Spec

## Verified From Public Docs And Source

The public `security-guidance` docs and repository show these behaviors:

1. Deterministic edit-time reminders run without a model call.
2. End-of-turn review runs on a capped diff, anchored to git state.
3. Commit and push review is deeper than the background turn review.
4. Repo guidance is additive only.
5. Custom deterministic patterns are additive only.
6. Review layers have kill switches and caps.
7. Logging emphasizes metadata rather than raw sensitive content.
8. The deeper reviewer reads changed files fully before deciding.

## Inferred Design Constraints

These points are informed by the public implementation shape but still need platform verification in our adapters:

1. Event binding differs by host runtime.
2. Background review must be rate-limited and deduplicated.
3. Reviewer context must be isolated from the writer context.

## Our Extension Targets

1. Shared review core reused by all adapters.
2. Local-first mode with no model requirement for baseline coverage.
3. Structured findings, JSONL audit trail, and SARIF-friendly output.
4. Suppression governance with owner, justification, and expiry.
5. Future AST, Semgrep, IaC, dependency, and trust-boundary rules.
