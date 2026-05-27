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
