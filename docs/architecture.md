# Architecture

## Problem

Build a portable security-review system that preserves a three-layer review model without binding the core logic to a single coding agent runtime.

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
- Expands one hop of local JS/TS import context.
- Continues when nearby context files cannot be parsed or read.

## Core Modules

- `config.js` parses additive policy and validates shape.
- `findings.js` creates stable finding objects.
- `rules.js` defines built-in deterministic rules.
- `patterns.js` evaluates deterministic rules over diffs and file paths.
- `suppressions.js` applies owner- and expiry-bound suppressions.
- `sarif.js` emits CI- and IDE-friendly result bundles.
- `review.js` orchestrates capped review and audit logging.
- `review.js` also owns checkpoint-mode file collection and one-hop import expansion.
- `jsonl.js` emits metadata-only audit events.

## Adapter Strategy

- OpenCode adapter:
  - thin plugin entrypoints,
  - explicit payload normalization per supported event,
  - logging bridge.
- Codex adapter:
  - explicit edit, turn, and checkpoint entrypoints,
  - same finding schema,
  - same policy loading.

## Security Stance

- Additive-only repo policy.
- Suppressions must be explicit, attributable, and optionally expiring.
- No suppressive repo hints for built-in rules.
- No shell execution in core.
- Path and input normalization before evaluation.
