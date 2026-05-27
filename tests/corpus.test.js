import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runCorpus } from "../src/core/corpus.js";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("corpus runner validates all baseline cases", () => {
  const report = runCorpus({
    manifestPath: path.join(repoRoot, "tests/corpus/basic.json"),
    baseDir: repoRoot
  });

  assert.equal(report.failedCases, 0);
  assert.equal(report.passedCases, report.totalCases);
});

