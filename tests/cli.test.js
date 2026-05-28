import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("CLI emits SARIF", () => {
  const output = execFileSync(
    "node",
    [
      "./src/cli.js",
      "--diff-file",
      "./tests/fixtures/sample.diff",
      "--changed-files",
      "src/auth/login.js",
      "--format",
      "sarif"
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.version, "2.1.0");
});

test("CLI emits corpus report", () => {
  const output = execFileSync(
    "node",
    ["./src/cli.js", "--corpus", "./tests/corpus/basic.json"],
    { cwd: repoRoot, encoding: "utf8" }
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.failedCases, 0);
});

test("CLI exits non-zero when findings meet severity threshold", () => {
  assert.throws(
    () =>
      execFileSync(
        "node",
        [
          "./src/cli.js",
          "--diff-file",
          "./tests/fixtures/sample.diff",
          "--changed-files",
          "src/auth/login.js",
          "--fail-on-severity",
          "high"
        ],
        { cwd: repoRoot, encoding: "utf8" }
      ),
    /Command failed/
  );
});

test("CLI strict corpus exits zero on clean baseline corpus expectations", () => {
  const output = execFileSync(
    "node",
    [
      "./src/cli.js",
      "--corpus",
      "./tests/corpus/basic.json",
      "--strict-corpus"
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.failedCases, 0);
});

test("CLI checkpoint mode reads working tree files from repoRoot", () => {
  const output = execFileSync(
    "node",
    [
      "./src/cli.js",
      "--review-mode",
      "checkpoint",
      "--repo-root",
      "./tests/fixtures/checkpoint-repo",
      "--changed-files-file",
      "./tests/fixtures/checkpoint-changed-files.txt",
      "--layer",
      "commit"
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].source.ruleId, "builtin-dangerous-child-process-shell-true");
});

test("CLI turn mode uses the configured command reviewer when enabled", () => {
  const output = execFileSync(
    "node",
    [
      "./src/cli.js",
      "--review-mode",
      "turn",
      "--config",
      "./tests/fixtures/turn-review.config.json",
      "--diff-file",
      "./tests/fixtures/turn-review.diff",
      "--changed-files",
      "src/auth/flow.js",
      "--repo-root",
      "."
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.modelReview.status, "completed");
  assert.ok(
    parsed.findings.some(
      (finding) => finding.source.ruleId === "model-turn-review-mock-fixture"
    )
  );
});

test("CLI debug mode emits metadata-only runtime control output", () => {
  const result = spawnSync(
    "node",
    [
      "./src/cli.js",
      "--diff-file",
      "./tests/fixtures/sample.diff",
      "--changed-files",
      "src/auth/login.js"
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        SECURITY_REVIEW_ENABLED_LAYERS: "edit,commit,push",
        SECURITY_REVIEW_DEBUG: "true"
      }
    }
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.findings.length, 0);
  assert.match(result.stderr, /"kind":"debug"/);
  assert.match(result.stderr, /"skipped":true/);
});

test("CLI skips disabled layers and reports the skip metadata", () => {
  const output = execFileSync(
    "node",
    [
      "./src/cli.js",
      "--review-mode",
      "turn",
      "--diff-file",
      "./tests/fixtures/sample.diff",
      "--changed-files",
      "src/auth/login.js",
      "--enabled-layers",
      "edit,commit,push"
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.findings.length, 0);
  assert.equal(parsed.modelReview.status, "disabled-by-layer");
  assert.match(parsed.auditEvent, /"skipped":true/);
});

test("CLI enforces runtime caps from flags and surfaces truncation metadata", () => {
  const output = execFileSync(
    "node",
    [
      "./src/cli.js",
      "--diff-file",
      "./tests/fixtures/sample.diff",
      "--changed-files",
      "src/auth/login.js",
      "--max-diff-bytes",
      "32"
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.findings.length, 0);
  assert.match(parsed.auditEvent, /"budgetTruncated":true/);
});
