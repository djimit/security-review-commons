import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runDeterministicReview } from "../src/core/review.js";

const fixturesDir = path.resolve(import.meta.dirname, "fixtures");

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

test("workflow rules catch dangerous GitHub Actions patterns", () => {
  const diff = fs.readFileSync(
    path.join(fixturesDir, "workflow-dangerous.yml"),
    "utf8"
  );
  const result = runDeterministicReview({
    diff,
    changedFiles: [".github/workflows/dangerous.yml"],
    layer: "turn"
  });

  const ruleIds = result.findings.map((finding) => finding.source.ruleId).sort();
  assert.deepEqual(ruleIds, [
    "builtin-github-actions-curl-pipe-shell",
    "builtin-github-actions-pull-request-target",
    "builtin-github-actions-write-all-permissions"
  ]);
});

test("container and infrastructure rules catch privilege and exposure drift", () => {
  const dockerResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "Dockerfile.root"), "utf8"),
    changedFiles: ["Dockerfile"],
    layer: "turn"
  });
  const k8sResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "k8s-privileged.yaml"), "utf8"),
    changedFiles: ["deploy/k8s-privileged.yaml"],
    layer: "turn"
  });
  const tfResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "public-ssh.tf"), "utf8"),
    changedFiles: ["infra/public-ssh.tf"],
    layer: "turn"
  });

  assert.equal(dockerResult.findings[0].source.ruleId, "builtin-dockerfile-missing-user");
  assert.deepEqual(
    k8sResult.findings.map((finding) => finding.source.ruleId).sort(),
    ["builtin-kubernetes-privileged-container", "builtin-kubernetes-runas-root"]
  );
  assert.equal(
    tfResult.findings[0].source.ruleId,
    "builtin-terraform-public-ssh-ingress"
  );
});

test("dependency governance rule catches catch-all selectors", () => {
  const diff = fs.readFileSync(
    path.join(fixturesDir, "package-unpinned.json"),
    "utf8"
  );
  const result = runDeterministicReview({
    diff,
    changedFiles: ["package.json"],
    layer: "turn"
  });

  assert.equal(
    result.findings[0].source.ruleId,
    "builtin-package-json-unpinned-version"
  );
});
