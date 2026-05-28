import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");

function readManifest() {
  return JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "tests/fixtures/runtime-fixtures.json"),
      "utf8"
    )
  );
}

test("runtime fixture manifest covers supported OpenCode and plugin replay payloads", () => {
  const manifest = readManifest();
  const fixtures = manifest.entries.map((entry) => entry.fixture).sort();

  assert.deepEqual(fixtures, [
    "./tests/fixtures/opencode/file-edited.json",
    "./tests/fixtures/opencode/session-diff.json",
    "./tests/fixtures/opencode/session-idle.json",
    "./tests/fixtures/opencode/tool-execute-before-push.json",
    "./tests/fixtures/plugin/post-tool-use-write.json",
    "./tests/fixtures/plugin/pre-tool-use-bash-git-commit.json",
    "./tests/fixtures/plugin/stop.json"
  ]);
  assert.equal(
    manifest.entries.every((entry) => entry.source === "synthetic"),
    true
  );
});

test("runtime fixture capture script writes a scrubbed fixture and manifest entry", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "src-runtime-fixture-"));
  const output = execFileSync(
    "node",
    [
      "./scripts/capture-runtime-fixture.js",
      "--base-dir",
      tempDir,
      "--runtime",
      "claude-plugin",
      "--event",
      "PostToolUse.Write",
      "--fixture",
      "./fixtures/post-tool-use-write.json",
      "--manifest",
      "./runtime-fixtures.json",
      "--redact-paths",
      "tool_input.file_path"
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      input: JSON.stringify({
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/tmp/secret/path.js",
          content: "const token = 'x';"
        }
      })
    }
  );

  const summary = JSON.parse(output);
  const fixture = JSON.parse(
    fs.readFileSync(path.join(tempDir, "fixtures/post-tool-use-write.json"), "utf8")
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(tempDir, "runtime-fixtures.json"), "utf8")
  );

  assert.equal(summary.fixture, "./fixtures/post-tool-use-write.json");
  assert.equal(fixture.tool_input.file_path, "<redacted>");
  assert.equal(manifest.entries.length, 1);
  assert.equal(manifest.entries[0].runtime, "claude-plugin");
  assert.equal(manifest.entries[0].source, "captured-live");
});
