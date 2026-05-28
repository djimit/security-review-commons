import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/core/config.js";

test("loadConfig merges defaults and compiles regexes", () => {
  const config = loadConfig({
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
        expiresOn: "2027-01-31"
      }
    ]
  });

  assert.equal(config.suppressions.length, 1);
});

test("loadConfig accepts turn review command metadata", () => {
  const config = loadConfig({
    turnReview: {
      enabled: true,
      provider: "mock",
      model: "fixture",
      command: {
        executable: "node",
        args: ["./tests/fixtures/mock-turn-reviewer.js"]
      }
    }
  });

  assert.equal(config.turnReview.enabled, true);
  assert.equal(config.turnReview.command.executable, "node");
});
