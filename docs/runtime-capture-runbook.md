# Runtime Capture Runbook

## Purpose

This runbook turns the remaining runtime-proof gap into an operator checklist.

For a fill-in worksheet you can use during the session, see [docs/runtime-capture-worksheet.md](./runtime-capture-worksheet.md).

Use it when you have access to:

- a real packaged-plugin host session, or
- a real OpenCode plugin session

The goal is to replace or supplement the current synthetic fixtures with scrubbed live payloads without leaking secrets, file contents, or absolute paths.

## Rules

- Capture one event at a time.
- Scrub before check-in.
- Manually review every captured fixture before commit.
- Do not claim live runtime proof for an event until:
  - the captured fixture is checked in,
  - replay or normalization tests pass against it,
  - the provenance manifest marks it as `captured-live`.

## Required Events

### Packaged plugin

- `PostToolUse.Write`
- `PreToolUse.Bash.git-commit`
- `PreToolUse.Bash.git-push`
- `Stop`

### OpenCode

- `file.edited`
- `session.diff`
- `session.idle`
- `tool.execute.before.git-commit`
- `tool.execute.before.git-push`

## Capture Checklist

For each event:

1. Trigger the real runtime event once with a representative but non-sensitive test case.
2. Save the raw JSON payload to a temporary local file outside the repo if needed.
3. Run the capture command for that event.
4. Review the generated fixture for:
   - secrets or tokens
   - cookies or authorization headers
   - absolute paths
   - raw business data or sensitive source content
5. If needed, rerun with additional `--redact-paths`.
6. Re-run the relevant tests.
7. Update docs only after the captured fixture is committed and passing.

## Packaged Plugin Commands

### `PostToolUse.Write`

```bash
cat raw-plugin-post-write.json | npm run capture:fixture -- \
  --runtime claude-plugin \
  --event PostToolUse.Write \
  --fixture ./tests/fixtures/plugin/post-tool-use-write.json \
  --manifest ./tests/fixtures/runtime-fixtures.json \
  --redact-paths tool_input.file_path \
  --notes "Scrubbed live packaged-plugin payload for post-write review."
```

### `PreToolUse.Bash.git-commit`

```bash
cat raw-plugin-pre-commit.json | npm run capture:fixture -- \
  --runtime claude-plugin \
  --event PreToolUse.Bash.git-commit \
  --fixture ./tests/fixtures/plugin/pre-tool-use-bash-git-commit.json \
  --manifest ./tests/fixtures/runtime-fixtures.json \
  --redact-paths cwd \
  --notes "Scrubbed live packaged-plugin payload for git commit checkpoint review."
```

### `PreToolUse.Bash.git-push`

```bash
cat raw-plugin-pre-push.json | npm run capture:fixture -- \
  --runtime claude-plugin \
  --event PreToolUse.Bash.git-push \
  --fixture ./tests/fixtures/plugin/pre-tool-use-bash-git-push.json \
  --manifest ./tests/fixtures/runtime-fixtures.json \
  --redact-paths cwd \
  --notes "Scrubbed live packaged-plugin payload for git push checkpoint review."
```

### `Stop`

```bash
cat raw-plugin-stop.json | npm run capture:fixture -- \
  --runtime claude-plugin \
  --event Stop \
  --fixture ./tests/fixtures/plugin/stop.json \
  --manifest ./tests/fixtures/runtime-fixtures.json \
  --redact-paths cwd \
  --notes "Scrubbed live packaged-plugin payload for stop-turn review."
```

## OpenCode Commands

### `file.edited`

```bash
cat raw-opencode-file-edited.json | npm run capture:fixture -- \
  --runtime opencode \
  --event file.edited \
  --fixture ./tests/fixtures/opencode/file-edited.json \
  --manifest ./tests/fixtures/runtime-fixtures.json \
  --notes "Scrubbed live OpenCode payload for file.edited normalization."
```

### `session.diff`

```bash
cat raw-opencode-session-diff.json | npm run capture:fixture -- \
  --runtime opencode \
  --event session.diff \
  --fixture ./tests/fixtures/opencode/session-diff.json \
  --manifest ./tests/fixtures/runtime-fixtures.json \
  --notes "Scrubbed live OpenCode payload for session.diff normalization."
```

### `session.idle`

```bash
cat raw-opencode-session-idle.json | npm run capture:fixture -- \
  --runtime opencode \
  --event session.idle \
  --fixture ./tests/fixtures/opencode/session-idle.json \
  --manifest ./tests/fixtures/runtime-fixtures.json \
  --notes "Scrubbed live OpenCode payload for session.idle normalization."
```

### `tool.execute.before.git-commit`

```bash
cat raw-opencode-tool-before-commit.json | npm run capture:fixture -- \
  --runtime opencode \
  --event tool.execute.before.git-commit \
  --fixture ./tests/fixtures/opencode/tool-execute-before-commit.json \
  --manifest ./tests/fixtures/runtime-fixtures.json \
  --redact-paths workspace.root,repoRoot,cwd \
  --notes "Scrubbed live OpenCode payload for git commit checkpoint normalization."
```

### `tool.execute.before.git-push`

```bash
cat raw-opencode-tool-before-push.json | npm run capture:fixture -- \
  --runtime opencode \
  --event tool.execute.before.git-push \
  --fixture ./tests/fixtures/opencode/tool-execute-before-push.json \
  --manifest ./tests/fixtures/runtime-fixtures.json \
  --redact-paths workspace.root,repoRoot,cwd \
  --notes "Scrubbed live OpenCode payload for git push checkpoint normalization."
```

## Validation Commands

Run the narrowest relevant validation after each capture batch:

```bash
node --test tests/runtime-fixtures.test.js tests/adapters.test.js tests/plugin-hooks.test.js
```

Then run the broader gate before committing:

```bash
npm run check
npm run benchmark
```

## Documentation Follow-up

After a captured fixture lands and passes:

- update `docs/runtime-fixtures.md`
- update `docs/opencode-integration.md` if OpenCode field shapes changed
- update `docs/release-0.2.0.md` and `docs/completion-audit.md` if the live-proof claim changed materially
- update the OpenSpec phase-4 task state
