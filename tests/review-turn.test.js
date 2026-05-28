import test from "node:test";
import assert from "node:assert/strict";
import { runTurnReview } from "../src/core/review.js";
import { createCommandTurnReviewer } from "../src/plugin/command-turn-reviewer.js";

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

test("turn review skips entirely when the turn layer is disabled", async () => {
  const result = await runTurnReview({
    diff: 'const token = "supersecret12345";',
    changedFiles: ["src/auth/login.js"],
    config: {
      enabledLayers: ["edit", "commit", "push"],
      turnReview: {
        enabled: true,
        provider: "mock",
        model: "fixture"
      }
    }
  });

  assert.equal(result.findings.length, 0);
  assert.equal(result.modelReview.status, "disabled-by-layer");
  assert.equal(result.reviewContext, null);
  assert.match(result.auditEvent, /"skipped":true/);
});

test("turn review does not call reviewer when turnReview is enabled but turn layer is disabled", async () => {
  let reviewerCalled = false;

test("command reviewer rejects relative executable paths", async () => {
  assert.throws(
    () =>
      createCommandTurnReviewer({
        turnReview: {
          enabled: true,
          timeoutMs: 5_000,
          commandAllowlist: [],
          command: { executable: "./mock-reviewer.js", args: [] }
        }
      }),
    /absolute path/i
  );
});

test("command reviewer fails safely on invalid JSON output", async () => {
  const reviewer = createCommandTurnReviewer({
    turnReview: {
      enabled: true,
      timeoutMs: 5_000,
      commandAllowlist: [{ id: "node", executable: process.execPath }],
      command: {
        id: "node",
        args: ["-e", "process.stdout.write('not-json')"]
      }
    }
  });

  await assert.rejects(
    reviewer({
      context: { prompt: "p", diff: "d", changedFiles: [] }
    }),
    /parse failed/
  );
});

test("command reviewer enforces timeout floor and captures timeout failures", async () => {
  const reviewer = createCommandTurnReviewer({
    turnReview: {
      enabled: true,
      timeoutMs: 1,
      commandAllowlist: [{ id: "node", executable: process.execPath }],
      command: {
        id: "node",
        args: ["-e", "setTimeout(() => process.stdout.write('{\"findings\":[]}'), 1500)"]
      }
    }
  });

  await assert.rejects(
    reviewer({
      context: { prompt: "p", diff: "d", changedFiles: [] }
    }),
    /execution failed/
  );
});

test("turn review skips entirely when the turn layer is disabled", async () => {
  const result = await runTurnReview({
    diff: "if (bypassAuth) return user;",
    changedFiles: ["src/auth/flow.js"],
    config: {
      enabledLayers: ["edit", "commit", "push"],
      turnReview: {
        enabled: true,
        provider: "mock",
        model: "fixture"
      }
    },
    reviewer: async () => {
      reviewerCalled = true;
      return {
        findings: [
          {
            title: "Should not be used",
            severity: "medium",
            category: "test"
          }
        ]
      };
    }
  });

  assert.equal(reviewerCalled, false);
  assert.equal(result.findings.length, 0);
  assert.equal(result.modelReview.status, "disabled-by-layer");
  assert.equal(result.reviewContext, null);
  assert.match(result.auditEvent, /"skipped":true/);
});


test("turn review fails with schema error code for malformed model response", async () => {
  const result = await runTurnReview({
    diff: "const ok = true;",
    changedFiles: ["src/ok.js"],
    config: {
      turnReview: {
        enabled: true,
        provider: "mock",
        model: "fixture"
      }
    },
    reviewer: async () => ({
      findings: [
        {
          title: "bad finding",
          files: [123]
        }
      ]
    })
  });

  assert.equal(result.modelReview.status, "failed");
  assert.match(result.modelReview.error, /SRC_MODEL_RESPONSE_SCHEMA_INVALID/);
});
