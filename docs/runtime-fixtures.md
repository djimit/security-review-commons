# Runtime Fixtures

## Status

Runtime payload fixtures now carry explicit provenance through `tests/fixtures/runtime-fixtures.json`.

This manifest distinguishes:

- **captured-live** fixtures whose field shapes were verified against real host/runtime events and scrubbed through the capture pipeline
- **synthetic** fixtures that match the documented hook contracts but have not yet been captured from a live host session

As of 2026-05-30:

- All 5 OpenCode events (`file.edited`, `session.diff`, `session.idle`, `tool.execute.before.git-commit`, `tool.execute.before.git-push`) have captured-live provenance with verified field shapes including the `args` top-level field discovered in `tool.execute.before` events.
- All 4 packaged-plugin events (`PostToolUse.Write`, `PreToolUse.Bash.git-commit`, `PreToolUse.Bash.git-push`, `Stop`) now have captured-live provenance from real Claude Code packaged-plugin sessions.
- Live packaged-plugin capture also verified additional top-level fields such as `session_id`, `permission_mode`, `effort`, `tool_use_id`, and `transcript_path`.

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

- parity beyond the documented supported event fields
