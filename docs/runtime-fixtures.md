# Runtime Fixtures

## Status

Runtime payload fixtures now carry explicit provenance through `tests/fixtures/runtime-fixtures.json`.

This manifest distinguishes:

- synthetic replay fixtures used for current local verification
- future scrubbed host-captured fixtures that can replace synthetic entries

The current repository state is still synthetic-only. That remains intentional and documented so runtime parity claims stay limited to replay coverage rather than live host proof.

## Covered Fixtures

Current manifest coverage includes:

- OpenCode `file.edited`
- OpenCode `session.diff`
- OpenCode `session.idle`
- OpenCode `tool.execute.before` for `git commit`
- OpenCode `tool.execute.before` for `git push`
- packaged plugin `PostToolUse`
- packaged plugin `PreToolUse` for `git commit`
- packaged plugin `PreToolUse` for `git push`
- packaged plugin `Stop`

## Capture Workflow

Use the capture script to ingest a real runtime payload from stdin, redact sensitive paths, write the fixture file, and upsert the provenance manifest:

```bash
cat payload.json | npm run capture:fixture -- \
  --runtime claude-plugin \
  --event PostToolUse.Write \
  --fixture ./tests/fixtures/plugin/post-tool-use-write.json \
  --manifest ./tests/fixtures/runtime-fixtures.json \
  --redact-paths tool_input.file_path
```

The script:

- reads JSON from stdin
- redacts the configured dotted-path fields to `"<redacted>"`
- writes the scrubbed fixture file
- upserts the runtime fixture manifest entry with source, supported top-level fields, and capture metadata

For an event-by-event operator checklist and ready-to-run commands, see [docs/runtime-capture-runbook.md](./runtime-capture-runbook.md).

## Verification

Runtime fixture verification currently proves:

- the manifest covers supported replay payloads
- each listed payload exists in the repo
- the capture script produces scrubbed fixtures and manifest entries

It does not yet prove:

- live host/runtime payload parity
- that any current fixture was captured from a real session
- parity beyond the documented supported event fields
