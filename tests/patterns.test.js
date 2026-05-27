import test from "node:test";
import assert from "node:assert/strict";
import { runDeterministicReview } from "../src/core/review.js";

test("deterministic review finds built-in risky patterns", () => {
  const diff = `
    const token = "supersecret12345";
    const child = spawn(userInput, { shell: true });
  `;
  const result = runDeterministicReview({
    diff,
    changedFiles: ["src/auth/login.js"],
    layer: "turn"
  });

  assert.equal(result.findings.length, 2);
  assert.match(result.auditEvent, /"findingCount":2/);
});

test("custom additive pattern is applied", () => {
  const diff = `const bypassAuth = true;`;
  const result = runDeterministicReview({
    diff,
    changedFiles: ["src/auth/login.js"],
    layer: "edit",
    config: {
      customPatterns: [
        {
          id: "custom-no-bypass-auth",
          title: "Avoid bypass auth flags",
          regex: "bypassAuth",
          severity: "high",
          pathRegex: "auth"
        }
      ]
    }
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.ruleId, "custom-no-bypass-auth");
});

test("suppressions remove only matching active findings", () => {
  const diff = `const token = "supersecret12345";`;
  const result = runDeterministicReview({
    diff,
    changedFiles: ["fixtures/demo.js"],
    layer: "turn",
    config: {
      suppressions: [
        {
          ruleId: "builtin-hardcoded-secret-token",
          pathRegex: "fixtures/",
          owner: "security-team",
          justification: "Intentional fixture pattern",
          expiresOn: "2027-01-31"
        }
      ]
    }
  });

  assert.equal(result.findings.length, 0);
  assert.equal(result.suppressedFindings.length, 1);
});
