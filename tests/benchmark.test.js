import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("benchmark harness reports hits misses and unresolved comparative gaps", () => {
  const output = execFileSync(
    "node",
    ["./scripts/run-benchmark.js", "--manifest", "./benchmarks/manifest.json"],
    { cwd: repoRoot, encoding: "utf8" }
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.manifestName, "security-review-commons-baseline-benchmark");
  assert.equal(parsed.failedCases, 0);
  assert.ok(parsed.hitCount >= 1);
  assert.equal(parsed.missCount, 0);
  assert.equal(parsed.falsePositiveCount, 0);
  assert.ok(parsed.unresolvedComparativeCases >= 1);
});
