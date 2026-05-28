# Claude Plugin Packaging

## Status

`security-review-commons` now ships a first-class Claude-compatible plugin wrapper around the shared review core:

- plugin manifest at `.claude-plugin/plugin.json`
- hook config at `hooks/hooks.json`
- hook command entrypoint at `bin/claude-security-hook.js`

The plugin packaging stays thin. All review logic still routes through the shared core in `src/core/`.

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
node --test tests/claude-plugin.test.js
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

For a local Claude Code install, point Claude Code at the repository root as the plugin root so the default paths resolve:

- `.claude-plugin/plugin.json`
- `hooks/hooks.json`
- `bin/claude-security-hook.js`

The plugin expects:

- `node` to be available on `PATH`
- `CLAUDE_PLUGIN_ROOT` to point at the plugin root
- `CLAUDE_PROJECT_DIR` to point at the active project when Claude Code provides it

## Debug Notes

- Hook commands read JSON input from stdin and print only a JSON object on stdout.
- Audit output stays metadata-only; hook responses summarize findings rather than echoing file contents.
- If a `git push` hook cannot resolve an upstream branch, it currently falls back to allowing the command instead of guessing the outbound diff.

## Known Gaps

- No model-backed `Stop` review yet
- No captured live Claude runtime fixtures yet; current replay tests use synthetic payloads
- No bounded multi-file checkpoint collector beyond the existing checkpoint review core
