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
  assert.deepEqual(report.benchmarkSummary.byReviewMode, {
    checkpoint: {
      totalCases: 5,
      passedCases: 5
    },
    deterministic: {
      totalCases: 51,
      passedCases: 51
    }
  });
  assert.deepEqual(report.benchmarkSummary.byLayer, {
    commit: {
      totalCases: 5,
      passedCases: 5
    },
    turn: {
      totalCases: 51,
      passedCases: 51
    }
  });
  assert.deepEqual(report.benchmarkSummary.byFramework.express, {
    totalCases: 1,
    passedCases: 1
  });
  assert.deepEqual(report.benchmarkSummary.byFramework.fastapi, {
    totalCases: 1,
    passedCases: 1
  });
  assert.deepEqual(report.benchmarkSummary.byFramework.django, {
    totalCases: 1,
    passedCases: 1
  });
  assert.deepEqual(
    report.benchmarkSummary.byExpectedRuleId["builtin-python-pickle-load"],
    {
      totalCases: 1,
      passedCases: 1
    }
  );
  assert.deepEqual(
    report.benchmarkSummary.byExpectedRuleId["semantic-js-redirect-tainted-input"],
    {
      totalCases: 1,
      passedCases: 1
    }
  );
  assert.deepEqual(
    report.benchmarkSummary.byExpectedRuleId["builtin-template-render-user-input"],
    {
      totalCases: 2,
      passedCases: 2
    }
  );
  assert.deepEqual(
    report.benchmarkSummary.byExpectedRuleId["builtin-python-subprocess-shell-true"],
    {
      totalCases: 1,
      passedCases: 1
    }
  );
  assert.deepEqual(
    report.benchmarkSummary.byExpectedRuleId["builtin-authz-check-disabled"],
    {
      totalCases: 1,
      passedCases: 1
    }
  );
  assert.deepEqual(
    report.benchmarkSummary.byExpectedRuleId["builtin-python-os-system"],
    {
      totalCases: 1,
      passedCases: 1
    }
  );
});
