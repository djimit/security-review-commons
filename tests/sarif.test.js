import test from "node:test";
import assert from "node:assert/strict";
import { findingsToSarif } from "../src/core/sarif.js";
import { runDeterministicReview } from "../src/core/review.js";

test("findingsToSarif emits one run with results", () => {
  const review = runDeterministicReview({
    diff: `const token = "supersecret12345";`,
    changedFiles: ["src/auth/login.js"],
    layer: "turn"
  });
  const sarif = findingsToSarif({ findings: review.findings });

  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs.length, 1);
  assert.equal(sarif.runs[0].results.length, 1);
});

