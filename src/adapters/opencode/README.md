# OpenCode Adapter

This adapter is intentionally thin. It maps OpenCode events into the shared review core.

## Event Mapping

- file edit or tool-write event -> `onFileEdited`
- session idle or turn completion -> `onSessionIdle`
- git commit or push interception -> `onGitCheckpoint`

## Verification Gap

The exact OpenCode event names and payload shape still need runtime verification against the installed host. This repository keeps the adapter honest by isolating those assumptions here.

