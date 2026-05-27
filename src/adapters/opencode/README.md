# OpenCode Adapter

This adapter is intentionally thin. It maps OpenCode events into the shared review core.

## Event Mapping

- `file.edited` -> `normalizeFileEditedEvent()` -> `onFileEdited()`
- `session.diff` -> `normalizeSessionDiffEvent()` -> `onSessionDiff()`
- `session.idle` -> `normalizeSessionIdleEvent()` -> `onSessionIdle()`
- `tool.execute.before` -> `normalizeToolExecuteBeforeEvent()` -> `onToolExecuteBefore()`

## Verification Gap

Event names are documented and the supported payload fields are fixture-backed, but live runtime capture from an installed OpenCode host is still pending. This repository keeps the adapter honest by isolating those assumptions here.
