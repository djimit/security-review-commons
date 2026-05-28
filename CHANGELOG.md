# Changelog

## 0.2.0

- support-matrix closure for synthetic replay coverage across packaged plugin `git commit` and `git push` plus OpenCode `tool.execute.before` commit and push variants
- broader high-signal authz, IDOR helper, template-render-string, and Python command-execution coverage with added positive and negative fixtures
- benchmark comparator sidecar artifact with explicit unresolved external statuses instead of implicit parity claims
- source-release workflow hardened so tag releases attach proof artifacts only, while npm publish now requires an explicit manual workflow dispatch and confirmation
- release-truth documentation for intended `v0.2.0` source release and current npm defer decision

## 0.1.0

- shared review core with deterministic edit review, turn review, and checkpoint review
- host plugin packaging with replayed `PostToolUse`, `PreToolUse`, and `Stop` hook coverage
- optional command-backed turn review with bounded prompts, runtime controls, and metadata-only debug output
- bounded checkpoint evidence collection with import and adjacent auth or config context plus explicit budgets
- additive guidance precedence for user, project, and repo-local scopes
- deterministic rule coverage for CI, containers, Terraform, dependency governance, redirect and DOM HTML sinks, auth or IDOR or template-injection web patterns, and Python deserialization or subprocess-shell hazards
- parser-backed JS or TS semantic flow checks for `exec`, `eval`, `fetch`, redirects, and path construction
- SARIF export, severity gating, corpus reporting, comparative baseline benchmark harness, and runtime fixture provenance or capture tooling
