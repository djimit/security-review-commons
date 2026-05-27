import test from "node:test";
import assert from "node:assert/strict";
import { onFileEdited } from "../src/adapters/opencode/plugin.js";
import {
  describeCodexLimitations,
  reviewWorkspaceChange
} from "../src/adapters/codex/adapter.js";

test("OpenCode adapter delegates to deterministic edit review", () => {
  const result = onFileEdited({
    diff: `const token = "supersecret12345";`,
    changedFiles: ["src/auth/login.js"]
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.layer, "edit");
});

test("Codex adapter reports explicit mode and limitations honestly", () => {
  const result = reviewWorkspaceChange({
    diff: `const bypassAuth = true;`,
    changedFiles: ["src/auth/login.js"],
    layer: "turn"
  });

  const limits = describeCodexLimitations();
  assert.ok(Array.isArray(result.findings));
  assert.equal(limits.supportsNativeBackgroundHooks, false);
  assert.equal(limits.supportsExplicitReviewEntrypoint, true);
});
