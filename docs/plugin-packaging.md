# Plugin Packaging

## Status

`security-review-commons` now ships a host plugin wrapper around the shared review core:

- plugin manifest at `.claude-plugin/plugin.json`
- hook config at `hooks/hooks.json`
- hook command entrypoint at `bin/plugin-security-hook.js`

The packaging stays thin. All review logic still routes through the shared core in `src/core/`.

## Current Hook Surface

### PostToolUse: `Edit|Write|MultiEdit`

- reads the edited file after a successful file edit
- runs deterministic edit review
- injects additional context when findings are present
- does not block the completed tool call

### PreToolUse: `Bash`

- inspects bash commands before execution
- intercepts `git commit` and `git push`
- runs checkpoint review over the staged commit set or outgoing push diff when it can resolve the git context
- includes bounded import and adjacent auth/config/router/middleware evidence collection
- denies the tool call on `high` or `critical` findings
- emits advisory context for lower-severity checkpoint findings

### Stop

- is opt-in through runtime environment controls
- collects the current working-tree diff and changed file list
- runs turn review with deterministic fallback and an optional command-based reviewer
- blocks stopping when findings meet the configured severity threshold

## Local Validation

Validate the packaged hook entrypoints with the local replay tests:

```bash
node --test tests/plugin-hooks.test.js
```

Run the full repository gate:

```bash
npm run check
```

Dry-run the package contents:

```bash
npm run pack:dry-run
```

Run the full turn-review and Stop-hook verification path:

```bash
node --test tests/review-turn.test.js tests/plugin-hooks.test.js
```

## Install Notes

For a local plugin install, point the host runtime at the repository root so the default paths resolve:

- `.claude-plugin/plugin.json`
- `hooks/hooks.json`
- `bin/plugin-security-hook.js`

The current host plugin contract expects:

- `node` to be available on `PATH`
- `CLAUDE_PLUGIN_ROOT` to point at the plugin root
- `CLAUDE_PROJECT_DIR` to point at the active project when the host provides it

Those environment variable names are host-defined and remain unchanged here.

## Runtime Controls

Current turn-review controls are environment-driven:

- `SECURITY_REVIEW_TURN_REVIEW_ENABLED=true`
- `SECURITY_REVIEW_TURN_REVIEW_PROVIDER=<name>`
- `SECURITY_REVIEW_TURN_REVIEW_MODEL=<name>`
- `SECURITY_REVIEW_TURN_REVIEW_MIN_SEVERITY=high`
- `SECURITY_REVIEW_TURN_REVIEW_COMMAND=<executable>`
- `SECURITY_REVIEW_TURN_REVIEW_ARGS=<json-array-or-space-delimited-args>`
- `SECURITY_REVIEW_TURN_REVIEW_TIMEOUT_MS=<milliseconds>`
- `SECURITY_REVIEW_TURN_REVIEW_MAX_DIFF_BYTES=<bytes>`
- `SECURITY_REVIEW_TURN_REVIEW_MAX_PROMPT_CHARS=<chars>`
- `SECURITY_REVIEW_TURN_REVIEW_MAX_FINDINGS=<count>`
- `SECURITY_REVIEW_USER_GUIDANCE_FILE=<absolute-path>`

## Guidance Precedence

Guidance is additive only in this slice. The loader merges scopes in this order:

1. user guidance from `SECURITY_REVIEW_USER_GUIDANCE_FILE`
2. project guidance from `.security-review/guidance.json`
3. repo-local guidance from `.security-review/guidance.local.json`

Supported additive fields in guidance files:

- `repoGuidance`
- `customPatterns`
- `suppressions`

Lower-precedence guidance does not remove or override higher-precedence guidance in this path. Explicit runtime config passed by the caller still applies after the discovered guidance files.

## Debug Notes

- Hook commands read JSON input from stdin and print only a JSON object on stdout.
- Audit output stays metadata-only; hook responses summarize findings rather than echoing file contents.
- If a `git push` hook cannot resolve an upstream branch, it currently falls back to allowing the command instead of guessing the outbound diff.

## Known Gaps

- No captured live runtime fixtures yet; current replay tests use synthetic payloads
- No built-in provider client ships in this slice; model-backed turn review depends on an external reviewer command
- Checkpoint evidence collection is still bounded by simple adjacency heuristics rather than a richer multi-file graph or inter-file taint engine
