import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  runCheckpointReview,
  runDeterministicReview
} from "../src/core/review.js";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("checkpoint review reads full changed files and imported local context", () => {
  const result = runCheckpointReview({
    repoRoot: path.join(repoRoot, "tests/fixtures/checkpoint-repo"),
    changedFiles: ["src/feature.js"],
    layer: "commit"
  });

  assert.equal(result.findings.length, 1);
  assert.equal(
    result.findings[0].source.ruleId,
    "builtin-dangerous-child-process-shell-true"
  );
  assert.deepEqual(result.findings[0].files, ["lib/command.js"]);
});

test("checkpoint review stays clean for safe nearby imports", () => {
  const result = runCheckpointReview({
    repoRoot: path.join(repoRoot, "tests/fixtures/checkpoint-safe-repo"),
    changedFiles: ["src/feature.js"],
    layer: "commit"
  });

  assert.equal(result.findings.length, 0);
  assert.match(result.auditEvent, /"contextFileCount":1/);
});

test("deterministic review remains diff-local for the same checkpoint fixture", () => {
  const diff = [
    'import { buildShellCommand } from "../lib/command.js";',
    "",
    "export function runTask(req) {",
    "  return buildShellCommand(req.query.name);",
    "}"
  ].join("\n");
  const result = runDeterministicReview({
    diff,
    changedFiles: ["src/feature.js"],
    layer: "turn"
  });

  assert.equal(result.findings.length, 0);
});

test("checkpoint review inspects bounded adjacent auth or config context", () => {
  const result = runCheckpointReview({
    repoRoot: path.join(repoRoot, "tests/fixtures/checkpoint-adjacent-repo"),
    changedFiles: ["src/routes/admin.js"],
    layer: "commit"
  });

  assert.equal(result.findings.length, 1);
  assert.equal(
    result.findings[0].source.ruleId,
    "builtin-hardcoded-secret-token"
  );
  assert.deepEqual(result.findings[0].files, ["src/auth/guard.js"]);
  assert.match(result.auditEvent, /"adjacentContextFileCount":1/);
});

test("checkpoint review stays out of unrelated nearby trees", () => {
  const result = runCheckpointReview({
    repoRoot: path.join(repoRoot, "tests/fixtures/checkpoint-adjacent-safe-repo"),
    changedFiles: ["src/routes/admin.js"],
    layer: "commit"
  });

  assert.equal(result.findings.length, 0);
});

test("checkpoint review respects explicit context file caps", () => {
  const result = runCheckpointReview({
    repoRoot: path.join(repoRoot, "tests/fixtures/checkpoint-adjacent-repo"),
    changedFiles: ["src/routes/admin.js"],
    layer: "commit",
    config: {
      checkpointReview: {
        maxContextFiles: 0
      }
    }
  });

  assert.equal(result.findings.length, 0);
  assert.match(result.auditEvent, /"adjacentContextFileCount":0/);
  assert.match(result.auditEvent, /"budgetTruncated":true/);
});

test("checkpoint review follows imports beyond one hop within depth budget", () => {
  const result = runCheckpointReview({
    repoRoot: path.join(repoRoot, "tests/fixtures/checkpoint-deep-repo"),
    changedFiles: ["src/feature.js"],
    layer: "commit"
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.ruleId, "builtin-eval-detected");
  assert.deepEqual(result.findings[0].files, ["lib/engine.js"]);
  assert.match(result.auditEvent, /"importContextFileCount":2/);
});

test("checkpoint review respects explicit import depth caps", () => {
  const result = runCheckpointReview({
    repoRoot: path.join(repoRoot, "tests/fixtures/checkpoint-deep-repo"),
    changedFiles: ["src/feature.js"],
    layer: "commit",
    config: {
      checkpointReview: {
        maxAdjacentSearchDepth: 1
      }
    }
  });

  assert.equal(result.findings.length, 0);
});
