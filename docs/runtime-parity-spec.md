# Runtime Parity Spec

## Verified Target Behaviors

This project targets these portable review behaviors:

1. Deterministic edit-time reminders run without a model call.
2. End-of-turn review runs on a capped diff.
3. Commit and push review are deeper than background turn review.
4. Repo guidance is additive only.
5. Custom deterministic patterns are additive only.
6. Review layers have kill switches and caps.
7. Logging emphasizes metadata rather than raw sensitive content.
8. Deeper review reads changed files fully before deciding.

## Inferred Design Constraints

These constraints still create the main host-runtime drift risks:

1. Event binding differs by host runtime.
2. Background review must be rate-limited and deduplicated.
3. Reviewer context must be isolated from writer context.

## Extension Targets

1. Shared review core reused by all adapters.
2. Local-first mode with no model requirement for baseline coverage.
3. Structured findings, JSONL audit trail, and SARIF-friendly output.
4. Suppression governance with owner, justification, and expiry.
5. Checkpoint review that reads full changed files plus one-hop local JS/TS import context.

## Current Runtime Status

1. Diff review is implemented in the shared core and exposed in both adapters.
2. Checkpoint review reads working tree files and nearby local JS/TS imports.
3. OpenCode event names are documented and payload normalization is fixture-backed, but live host payload capture is still pending.
4. Host plugin packaging exists, but replay tests remain synthetic rather than captured from a live session.
5. Codex integration remains explicit-entrypoint based. Native background lifecycle parity is still not claimed.
