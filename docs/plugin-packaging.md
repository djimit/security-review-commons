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
- denies the tool call on `high` or `critical` findings
- emits advisory context for lower-severity checkpoint findings

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

## Debug Notes

- Hook commands read JSON input from stdin and print only a JSON object on stdout.
- Audit output stays metadata-only; hook responses summarize findings rather than echoing file contents.
- If a `git push` hook cannot resolve an upstream branch, it currently falls back to allowing the command instead of guessing the outbound diff.

## Known Gaps

- No model-backed `Stop` review yet
- No captured live runtime fixtures yet; current replay tests use synthetic payloads
- No bounded multi-file checkpoint collector beyond the existing checkpoint review core
