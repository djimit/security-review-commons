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
