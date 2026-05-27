import test from "node:test";
import assert from "node:assert/strict";
import { onFileEdited } from "../src/adapters/opencode/plugin.js";
import {
  describeCodexLimitations,
  recommendedCodexEntrypoints,
  reviewWorkspaceChange
} from "../src/adapters/codex/adapter.js";
import {
  onSessionDiff,
  onToolExecuteBefore
} from "../src/adapters/opencode/plugin.js";

test("OpenCode adapter delegates to deterministic edit review", () => {
  const result = onFileEdited({
    diff: `const token = "supersecret12345";`,
    changedFiles: ["src/auth/login.js"]
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.layer, "edit");
});

test("OpenCode session diff maps to turn review", () => {
  const result = onSessionDiff({
    diff: `eval(userInput)`,
    changedFiles: ["src/worker.js"]
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.layer, "turn");
});

test("OpenCode git command interception maps push review", () => {
  const result = onToolExecuteBefore({
    tool: "bash",
    args: { command: "git push origin main" },
    diff: `const token = "supersecret12345";`,
    changedFiles: ["src/auth/login.js"]
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.layer, "push");
});

test("Codex adapter reports explicit mode and limitations honestly", () => {
  const result = reviewWorkspaceChange({
    diff: `const bypassAuth = true;`,
    changedFiles: ["src/auth/login.js"],
    layer: "turn"
  });

  const limits = describeCodexLimitations();
  const entrypoints = recommendedCodexEntrypoints();
  assert.ok(Array.isArray(result.findings));
  assert.equal(limits.supportsNativeBackgroundHooks, false);
  assert.equal(limits.supportsExplicitReviewEntrypoint, true);
  assert.equal(Array.isArray(entrypoints), true);
});
