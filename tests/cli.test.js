import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
