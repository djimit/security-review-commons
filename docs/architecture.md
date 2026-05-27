# Architecture

## Problem

Build a portable security-review system that preserves Anthropic's three-layer review model without binding the core logic to a single coding agent runtime.

## Layers

### Layer 1: Deterministic Edit Warning

- Triggered by file edit or write-adjacent events.
- Uses only deterministic pattern rules.
- Must be cheap, fast, and additive.

### Layer 2: Turn Diff Review

- Triggered at session idle or turn completion.
- Reviews a capped diff.
- Emits structured findings plus audit metadata.

### Layer 3: Commit Or Push Review

- Triggered before `git commit` or `git push`.
- Reads all changed files fully.
- May expand to nearby callers and control points.

## Core Modules

- `config.js` parses additive policy and validates shape.
- `findings.js` creates stable finding objects.
- `patterns.js` evaluates deterministic rules over diffs and file paths.
- `review.js` orchestrates capped review and audit logging.
- `jsonl.js` emits metadata-only audit events.

## Adapter Strategy

- OpenCode adapter:
  - thin plugin entrypoints,
  - platform event mapping,
  - logging bridge.
- Codex adapter:
  - explicit command-driven and plugin-driven fallback path,
  - same finding schema,
  - same policy loading.

## Security Stance

- Additive-only repo policy.
- No suppressive repo hints for built-in rules.
- No shell execution in core.
- Path and input normalization before evaluation.

