import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  normalizeFileEditedEvent,
  normalizeSessionDiffEvent,
  normalizeSessionIdleEvent,
  normalizeToolExecuteBeforeEvent,
  onFileEdited
} from "../src/adapters/opencode/plugin.js";
import {
  describeCodexLimitations,
  recommendedCodexEntrypoints,
  reviewCodexCheckpoint,
  reviewCodexEdit,
  reviewCodexTurn,
  reviewWorkspaceChange
} from "../src/adapters/codex/adapter.js";
import {
  onSessionDiff,
  onSessionIdle,
  onToolExecuteBefore
} from "../src/adapters/opencode/plugin.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const checkpointRepoRoot = path.join(
  repoRoot,
  "tests/fixtures/checkpoint-repo"
);

function readJsonFixture(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(repoRoot, relativePath), "utf8")
  );
}

test("OpenCode adapter delegates to deterministic edit review", () => {
  const result = onFileEdited(
    readJsonFixture("tests/fixtures/opencode/file-edited.json")
  );

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.layer, "edit");
});

test("OpenCode session diff maps to turn review", () => {
  const result = onSessionDiff(
    readJsonFixture("tests/fixtures/opencode/session-diff.json")
  );

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.layer, "turn");
});

test("OpenCode session idle maps to turn review", () => {
  const result = onSessionIdle(
    readJsonFixture("tests/fixtures/opencode/session-idle.json")
  );

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.layer, "turn");
});

test("OpenCode git command interception maps push review to checkpoint mode", () => {
  const fixture = readJsonFixture(
    "tests/fixtures/opencode/tool-execute-before-push.json"
  );
  const result = onToolExecuteBefore({
    ...fixture,
    repoRoot: checkpointRepoRoot
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.layer, "push");
  assert.match(result.auditEvent, /"reviewMode":"checkpoint"/);
});

test("OpenCode payload normalizers preserve explicit supported fields", () => {
  const fileEdited = normalizeFileEditedEvent(
    readJsonFixture("tests/fixtures/opencode/file-edited.json")
  );
  const sessionDiff = normalizeSessionDiffEvent(
    readJsonFixture("tests/fixtures/opencode/session-diff.json")
  );
  const sessionIdle = normalizeSessionIdleEvent(
    readJsonFixture("tests/fixtures/opencode/session-idle.json")
  );
  const toolExecute = normalizeToolExecuteBeforeEvent({
    ...readJsonFixture("tests/fixtures/opencode/tool-execute-before-push.json"),
    repoRoot: checkpointRepoRoot
  });

  assert.deepEqual(fileEdited.changedFiles, ["src/auth/login.js"]);
  assert.deepEqual(sessionDiff.changedFiles, ["src/worker.js"]);
  assert.deepEqual(sessionIdle.changedFiles, ["src/session.js"]);
  assert.equal(toolExecute.action, "push");
  assert.equal(toolExecute.repoRoot, checkpointRepoRoot);
});

test("Codex adapter exposes explicit edit, turn, and checkpoint entrypoints", () => {
  const editResult = reviewCodexEdit({
    diff: `const token = "supersecret12345";`,
    changedFiles: ["src/auth/login.js"]
  });
  const turnResult = reviewCodexTurn({
    diff: `eval(userInput)`,
    changedFiles: ["src/worker.js"]
  });
  const checkpointResult = reviewCodexCheckpoint({
    repoRoot: checkpointRepoRoot,
    changedFiles: ["src/feature.js"],
    layer: "commit"
  });

  assert.equal(editResult.findings[0].source.layer, "edit");
  assert.equal(turnResult.findings[0].source.layer, "turn");
  assert.equal(checkpointResult.findings[0].source.layer, "commit");
});

test("Codex adapter reports explicit mode and limitations honestly", () => {
  const result = reviewWorkspaceChange({
    diff: `eval(userInput)`,
    changedFiles: ["src/worker.js"],
    layer: "turn"
  });

  const limits = describeCodexLimitations();
  const entrypoints = recommendedCodexEntrypoints();
  assert.ok(Array.isArray(result.findings));
  assert.equal(limits.supportsNativeBackgroundHooks, false);
  assert.equal(limits.supportsExplicitReviewEntrypoint, true);
  assert.equal(limits.supportsExplicitCheckpointReview, true);
  assert.equal(Array.isArray(entrypoints), true);
  assert.equal(entrypoints.length, 4);
});
