# Copilot Instructions — security-review-commons

Portable, auditable code security review core with OpenCode and Codex adapters. Uses Acorn for JS/TS AST parsing and produces SARIF output.

## Commands

```bash
cd security-review-commons
npm ci
npm run check           # lint + test + corpus (runs all of below)
npm run lint            # syntax check via node --check
npm test                # node --test
npm run corpus          # test with basic corpus
npm run benchmark       # run benchmark suite
npm run capture:fixture # capture runtime fixture
npm run pack:dry-run    # test npm pack
```

## Architecture

ESM-only Node.js package (`"type": "module"`). Entry point: `src/cli.js`.

```
src/
├── index.js              # Main exports
├── cli.js                # CLI entry point
├── core/
│   ├── config.js         # Configuration management
│   ├── review.js         # Core review engine
│   └── sarif.js          # SARIF output formatter
├── adapters/
│   ├── opencode/         # OpenCode adapter
│   │   └── plugin.js
│   └── codex/            # Codex adapter
│       └── adapter.js
└── plugin/               # Plugin utilities
```

## Key Details

- **Node.js 20+ required** — uses ESM throughout.
- **Acorn** for JavaScript/TypeScript AST parsing (`acorn`, `acorn-typescript`, `acorn-walk`).
- **SARIF output** for integration with security scanning pipelines.
- **Strict corpus testing** — `npm run corpus` validates against a known-good test corpus.
