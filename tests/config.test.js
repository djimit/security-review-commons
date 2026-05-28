import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadConfig,
  loadGuidanceFiles,
  loadResolvedConfig,
  loadRuntimeConfigFromEnv
} from "../src/core/config.js";

test("loadConfig merges defaults and compiles regexes", () => {
  const config = loadConfig({
    debug: true,
    repoGuidance: ["Extra guidance"],
    customPatterns: [
      {
        id: "custom-test",
        title: "Test pattern",
        regex: "danger",
        severity: "medium"
      }
    ]
  });

  assert.equal(config.repoGuidance.length, 1);
  assert.equal(config.debug, true);
  assert.ok(config.customPatterns[0].compiledRegex.test("danger"));
});

test("loadConfig rejects excessive custom patterns", () => {
  assert.throws(() =>
    loadConfig({
      caps: { maxCustomPatterns: 1 },
      customPatterns: [
        { id: "a", title: "A", regex: "a", severity: "low" },
        { id: "b", title: "B", regex: "b", severity: "low" }
      ]
    })
  );
});

test("loadConfig accepts suppression metadata", () => {
  const config = loadConfig({
    suppressions: [
      {
        ruleId: "builtin-path-join-user-input",
        owner: "security-team",
        justification: "Test suppression coverage",
        expiresOn: "2027-01-31",
        approvedBy: "lead@example.com",
        ticket: "SEC-123",
        createdOn: "2026-05-01"
      }
    ]
  });

  assert.equal(config.suppressions.length, 1);
});

test("loadConfig accepts turn review command metadata", () => {
  const reviewerPath = process.execPath;
  const config = loadConfig({
    turnReview: {
      enabled: true,
      provider: "mock",
      model: "fixture",
      commandAllowlist: [{ id: "node", executable: reviewerPath }],
      command: {
        id: "node",
        args: ["./tests/fixtures/mock-turn-reviewer.js"]
      }
    }
  });

  assert.equal(config.turnReview.enabled, true);
  assert.equal(config.turnReview.command.id, "node");
});

test("loadConfig accepts checkpoint review budget metadata", () => {
  const config = loadConfig({
    checkpointReview: {
      enabledAdjacentContext: true,
      maxContextFiles: 4,
      maxContextBytes: 4096,
      maxAdjacentSearchDepth: 3
    }
  });

  assert.equal(config.checkpointReview.maxContextFiles, 4);
  assert.equal(config.checkpointReview.maxContextBytes, 4096);
  assert.equal(config.checkpointReview.maxAdjacentSearchDepth, 3);
});

test("guidance files are loaded in user, project, local order and remain additive", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "src-guidance-"));
  const guidanceDir = path.join(tempDir, ".security-review");
  const userGuidancePath = path.join(tempDir, "user-guidance.json");

  fs.mkdirSync(guidanceDir, { recursive: true });
  fs.writeFileSync(
    userGuidancePath,
    JSON.stringify({ repoGuidance: ["user guidance"] })
  );
  fs.writeFileSync(
    path.join(guidanceDir, "guidance.json"),
    JSON.stringify({
      repoGuidance: ["project guidance"],
      customPatterns: [
        {
          id: "project-rule",
          title: "Project rule",
          regex: "project-danger",
          severity: "medium"
        }
      ]
    })
  );
  fs.writeFileSync(
    path.join(guidanceDir, "guidance.local.json"),
    JSON.stringify({
      repoGuidance: ["local guidance"],
      suppressions: [
        {
          ruleId: "builtin-hardcoded-secret-token",
          owner: "local-owner",
          justification: "Local guidance test"
        }
      ]
    })
  );

  const loaded = loadGuidanceFiles({
    repoRoot: tempDir,
    env: {
      SECURITY_REVIEW_USER_GUIDANCE_FILE: userGuidancePath
    }
  });

  assert.deepEqual(
    loaded.config.repoGuidance,
    ["user guidance", "project guidance", "local guidance"]
  );
  assert.equal(loaded.sources.length, 3);
  assert.equal(loaded.sources[0].scope, "user");
  assert.equal(loaded.sources[1].scope, "project");
  assert.equal(loaded.sources[2].scope, "local");
});

test("resolved config preserves additive guidance and explicit caller config", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "src-guidance-merge-"));
  const guidanceDir = path.join(tempDir, ".security-review");

  fs.mkdirSync(guidanceDir, { recursive: true });
  fs.writeFileSync(
    path.join(guidanceDir, "guidance.json"),
    JSON.stringify({
      repoGuidance: ["project guidance"],
      customPatterns: [
        {
          id: "project-rule",
          title: "Project rule",
          regex: "project-danger",
          severity: "medium"
        }
      ]
    })
  );

  const config = loadResolvedConfig({
    repoRoot: tempDir,
    rawConfig: {
      repoGuidance: ["explicit guidance"],
      customPatterns: [
        {
          id: "explicit-rule",
          title: "Explicit rule",
          regex: "explicit-danger",
          severity: "high"
        }
      ]
    }
  });

  assert.deepEqual(config.repoGuidance, [
    "project guidance",
    "explicit guidance"
  ]);
  assert.equal(config.customPatterns.length, 2);
});

test("runtime env overrides expose layer, debug, and checkpoint controls", () => {
  const runtimeConfig = loadRuntimeConfigFromEnv({
    SECURITY_REVIEW_ENABLED_LAYERS: "edit,commit",
    SECURITY_REVIEW_DEBUG: "true",
    SECURITY_REVIEW_MAX_DIFF_BYTES: "2048",
    SECURITY_REVIEW_MAX_CHANGED_FILES: "3",
    SECURITY_REVIEW_CHECKPOINT_ADJACENT_CONTEXT: "false",
    SECURITY_REVIEW_CHECKPOINT_MAX_CONTEXT_FILES: "2",
    SECURITY_REVIEW_CHECKPOINT_MAX_CONTEXT_BYTES: "4096",
    SECURITY_REVIEW_CHECKPOINT_MAX_ADJACENT_DEPTH: "1"
  });

  assert.deepEqual(runtimeConfig.enabledLayers, ["edit", "commit"]);
  assert.equal(runtimeConfig.debug, true);
  assert.equal(runtimeConfig.caps.maxDiffBytes, 2048);
  assert.equal(runtimeConfig.caps.maxChangedFiles, 3);
  assert.equal(runtimeConfig.checkpointReview.enabledAdjacentContext, false);
  assert.equal(runtimeConfig.checkpointReview.maxContextFiles, 2);
  assert.equal(runtimeConfig.checkpointReview.maxContextBytes, 4096);
  assert.equal(runtimeConfig.checkpointReview.maxAdjacentSearchDepth, 1);
});
