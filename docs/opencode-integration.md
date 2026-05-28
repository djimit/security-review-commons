# OpenCode Integration

## Verified Current Surface

As verified against the OpenCode plugin docs updated May 27, 2026:

- Project plugins load from `.opencode/plugins/`.
- Global plugins load from `~/.config/opencode/plugins/`.
- Relevant documented events include:
  - `file.edited`
  - `session.diff`
  - `session.idle`
  - `tool.execute.before`
  - `tool.execute.after`
- Structured plugin logging should use `client.app.log()`.

## Mapping In This Repository

- `file.edited` -> deterministic edit warnings
- `session.diff` -> capped turn diff review
- `session.idle` -> second turn review checkpoint for background-style usage
- `tool.execute.before` -> inspect bash commands and elevate `git commit` / `git push` into checkpoint review layers

## Important Gap

The docs confirm event names, loading, and logging, but they do not fully specify the event payload shape for every event. This repository now keeps explicit normalizers per supported event and backs them with synthetic fixtures so host-specific normalization can evolve without changing the shared core.

## Capture Tooling

To capture a scrubbed live payload for review before checking it in:

```bash
node ./scripts/capture-runtime-fixture.js \
  --runtime opencode \
  --event file.edited \
  --fixture ./tests/fixtures/opencode/captured-file-edited.json \
  --manifest ./tests/fixtures/runtime-fixtures.json \
  < raw-payload.json
```

The capture helper preserves payload shape while redacting obvious secrets and absolute paths. Captured fixtures still need manual review before they should replace or supplement the synthetic fixtures in `tests/fixtures/opencode/`.
