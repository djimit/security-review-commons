import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { scrubRuntimeFixture } from "../src/adapters/runtime-fixtures.js";

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
    "./tests/fixtures/opencode/tool-execute-before-commit.json",
    "./tests/fixtures/opencode/tool-execute-before-push.json",
    "./tests/fixtures/plugin/post-tool-use-write.json",
    "./tests/fixtures/plugin/pre-tool-use-bash-git-commit.json",
    "./tests/fixtures/plugin/pre-tool-use-bash-git-push.json",
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

test("runtime capture batch script prepares a worksheet and intake directories", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "src-runtime-batch-"));
  const output = execFileSync(
    "node",
    [
      "./scripts/create-runtime-capture-batch.js",
      "--base-dir",
      repoRoot,
      "--output-dir",
      tempDir
    ],
    {
      cwd: repoRoot,
      encoding: "utf8"
    }
  );

  const summary = JSON.parse(output);
  const worksheetPath = path.join(tempDir, "runtime-capture-worksheet.md");

  assert.equal(summary.outputDir, tempDir);
  assert.equal(fs.existsSync(path.join(tempDir, "raw")), true);
  assert.equal(fs.existsSync(path.join(tempDir, "accepted")), true);
  assert.equal(fs.existsSync(path.join(tempDir, "rejected")), true);
  assert.equal(fs.existsSync(worksheetPath), true);
  assert.match(fs.readFileSync(worksheetPath, "utf8"), /Created:/);
  assert.match(
    fs.readFileSync(worksheetPath, "utf8"),
    /# Runtime Capture Worksheet/
  );
});

test("runtime fixture scrubbing removes obvious secrets and absolute paths", () => {
  const scrubbed = scrubRuntimeFixture({
    cwd: "/Users/example/project",
    tool_input: {
      file_path: "/Users/example/project/src/auth/login.js",
      content: 'const token = "supersecret12345";'
    },
    authorization: "Bearer abc.def.ghi"
  });

  assert.equal(scrubbed.cwd, "<ABSOLUTE_PATH>");
  assert.equal(scrubbed.tool_input.file_path, "<ABSOLUTE_PATH>");
  assert.match(scrubbed.tool_input.content, /<REDACTED_SECRET>/);
  assert.equal(scrubbed.authorization, "<REDACTED>");
});
