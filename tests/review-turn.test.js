import test from "node:test";
import assert from "node:assert/strict";
import { runTurnReview } from "../src/core/review.js";

test("turn review falls back to deterministic findings when model review is disabled", async () => {
  const result = await runTurnReview({
    diff: 'const token = "supersecret12345";',
    changedFiles: ["src/auth/login.js"]
  });

  assert.equal(result.modelReview.status, "disabled");
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.layer, "turn");
});

test("turn review merges model findings into the shared finding schema", async () => {
  const result = await runTurnReview({
    diff: "if (bypassAuth) return user;",
    changedFiles: ["src/auth/flow.js"],
    repoRoot: process.cwd(),
    config: {
      repoGuidance: ["Authorization checks must stay explicit."],
      turnReview: {
        enabled: true,
        provider: "mock",
        model: "fixture"
      }
    },
    reviewer: async () => ({
      findings: [
        {
          title: "Potential authorization bypass in changed flow",
          severity: "high",
          category: "auth-bypass",
          explanation: "The changed diff appears to bypass an authorization check."
        }
      ]
    })
  });

  assert.equal(result.modelReview.status, "completed");
  assert.equal(result.modelReview.findingCount, 1);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.ruleId, "model-turn-review-mock-fixture");
  assert.match(result.reviewContext.prompt, /Authorization checks must stay explicit/);
});

test("turn review records skipped model review when enabled without a reviewer", async () => {
  const result = await runTurnReview({
    diff: "const ok = true;",
    changedFiles: ["src/ok.js"],
    config: {
      turnReview: {
        enabled: true
      }
    }
  });

  assert.equal(result.modelReview.status, "skipped");
  assert.equal(result.modelReview.reason, "No turn reviewer was configured");
});
