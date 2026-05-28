# Runtime Capture Worksheet

Use this worksheet while running a live capture session from [docs/runtime-capture-runbook.md](./runtime-capture-runbook.md).

One worksheet can cover one full capture batch or a single runtime family. Duplicate the event sections if you want one record per attempt.

## Session Metadata

- operator:
- date:
- host/runtime:
- repo revision:
- session identifier:
- notes:

## Batch Exit Criteria

- [ ] every intended event was captured from a real host session
- [ ] every checked-in fixture was scrubbed and manually reviewed
- [ ] narrow replay tests passed
- [ ] broader verification passed or failures were recorded below
- [ ] provenance and docs updates were completed for every accepted fixture

## Event Record Template

Copy this section once per event you are capturing.

### Event

- runtime:
- event:
- representative trigger:
- raw payload file:
- destination fixture:
- manifest entry:

### Capture

- command used:
- capture timestamp:
- result:
  - [ ] captured
  - [ ] retried
  - [ ] rejected

### Scrub Review

- [ ] secrets or tokens removed
- [ ] cookies or authorization headers removed
- [ ] absolute paths removed
- [ ] sensitive source or business data removed
- [ ] manual fixture review completed

- scrub notes:
- additional redaction paths used:

### Shape Review

- [ ] payload shape matches the current synthetic assumption
- [ ] payload shape required parser or normalizer changes
- [ ] synthetic and captured fixtures should both remain

- shape notes:
- parser or normalizer follow-up:

### Validation

- narrow validation command:
- narrow validation result:
- broader validation command:
- broader validation result:

### Provenance And Docs

- [ ] fixture manifest updated to `captured-live`
- [ ] `docs/runtime-fixtures.md` updated if needed
- [ ] `docs/opencode-integration.md` updated if needed
- [ ] `docs/release-0.2.0.md` updated if the live-proof claim changed
- [ ] `docs/completion-audit.md` updated if the live-proof claim changed
- [ ] OpenSpec phase-4 task state updated if the accepted fixture changed shipped evidence

- follow-up notes:

## Event Checklist

Use these event rows to track batch completeness.

### Packaged Plugin

| Event | Planned | Captured | Accepted | Notes |
| --- | --- | --- | --- | --- |
| `PostToolUse.Write` | [ ] | [ ] | [ ] | |
| `PreToolUse.Bash.git-commit` | [ ] | [ ] | [ ] | |
| `PreToolUse.Bash.git-push` | [ ] | [ ] | [ ] | |
| `Stop` | [ ] | [ ] | [ ] | |

### OpenCode

| Event | Planned | Captured | Accepted | Notes |
| --- | --- | --- | --- | --- |
| `file.edited` | [ ] | [ ] | [ ] | |
| `session.diff` | [ ] | [ ] | [ ] | |
| `session.idle` | [ ] | [ ] | [ ] | |
| `tool.execute.before.git-commit` | [ ] | [ ] | [ ] | |
| `tool.execute.before.git-push` | [ ] | [ ] | [ ] | |

## Batch Summary

- accepted fixtures:
- rejected fixtures:
- parser or normalizer changes required:
- unresolved shape questions:
- docs updated:
- OpenSpec updated:
- release evidence impact:
