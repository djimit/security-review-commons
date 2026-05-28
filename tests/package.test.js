import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("npm pack dry run includes the documented package surface", () => {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  const parsed = JSON.parse(output);
  assert.equal(parsed.length, 1);
  const filePaths = parsed[0].files.map((entry) => entry.path).sort();

  assert.ok(filePaths.includes(".claude-plugin/plugin.json"));
  assert.ok(filePaths.includes("hooks/hooks.json"));
  assert.ok(filePaths.includes("bin/plugin-security-hook.js"));
  assert.ok(filePaths.includes("docs/plugin-packaging.md"));
  assert.ok(filePaths.includes("docs/runtime-fixtures.md"));
  assert.ok(filePaths.includes("src/cli.js"));
  assert.ok(filePaths.includes("src/core/review.js"));
  assert.ok(filePaths.includes("src/adapters/opencode/plugin.js"));
  assert.ok(filePaths.includes("src/adapters/codex/adapter.js"));
  assert.ok(filePaths.includes("schemas/security-review.config.schema.json"));

  assert.equal(filePaths.some((entry) => entry.startsWith("tests/")), false);
  assert.equal(filePaths.some((entry) => entry.startsWith("benchmarks/")), false);
  assert.equal(filePaths.some((entry) => entry.startsWith("scripts/")), false);
});
