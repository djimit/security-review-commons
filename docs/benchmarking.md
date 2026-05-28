# Benchmarking

## Status

The repository now ships a small benchmark harness for evidence-backed regression checks and product-positioning work.

Artifacts:

- manifest: `benchmarks/manifest.json`
- execution script: `scripts/run-benchmark.js`
- recorded baseline output: `benchmarks/results/baseline.json`

## Run The Harness

Generate or refresh the checked-in baseline artifact:

```bash
npm run benchmark
```

Print the current benchmark report to stdout instead of writing the artifact:

```bash
node ./scripts/run-benchmark.js --manifest ./benchmarks/manifest.json
```

Render a Markdown report:

```bash
node ./scripts/run-benchmark.js --manifest ./benchmarks/manifest.json --format markdown
```

## What The Report Measures

Per case, the harness records:

- expected rule IDs
- actual rule IDs
- hit rule IDs
- missing rule IDs
- unexpected rule IDs
- summary counts for active and suppressed findings

At the report level, it records:

- total passed and failed cases
- total hits
- total misses
- total false positives
- comparative cases that remain unresolved

## Current Limits

- The current baseline artifact is a self-benchmark of this repository, not a recorded run against another product.
- Comparative fields are intentionally marked unresolved until an external reference run is captured and reviewed.
- The harness covers deterministic, turn, checkpoint, and negative cases, but it does not yet capture live host-runtime payload differences.
