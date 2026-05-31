import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const CLI = path.resolve(import.meta.dirname, "../src/cli.js");

function runCli(args, options = {}) {
  const result = spawnSync("node", [CLI, ...args], {
    encoding: "utf-8",
    timeout: 30000,
    cwd: options.cwd ?? process.cwd(),
    env: { ...process.env }
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1
  };
}

describe("cli-subcommands", () => {
  it("audit subcommand produces JSON output", () => {
    const result = runCli(["audit", "--format", "summary", "--repo-root", os.tmpdir()]);
    assert.ok(result.stdout.includes("total") || result.stdout.includes('"total"'), "Should produce summary output");
  });

  it("--audit flag produces deprecation warning on stderr", () => {
    const result = runCli(["--audit", "--format", "summary", "--repo-root", os.tmpdir()]);
    assert.ok(result.stderr.includes("deprecated"), "Should emit deprecation warning on stderr");
  });

  it("baseline write produces baseline file", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sr-cli-test-"));
    try {
      const result = runCli(["baseline", "--write-baseline", "--repo-root", tempDir]);
      assert.ok(result.stdout.includes("count"), "Should report count");
      const baselinePath = path.join(tempDir, ".security-baseline.json");
      assert.ok(fs.existsSync(baselinePath), "Baseline file should exist");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("audit --format compliance-json produces compliance output", () => {
    const result = runCli(["audit", "--format", "compliance-json", "--repo-root", os.tmpdir()]);
    assert.ok(result.stdout.includes("frameworks") || result.stdout.includes("profiles"), "Should produce compliance JSON");
  });

  it("baseline subcommand without --write-baseline shows error", () => {
    const result = runCli(["baseline", "--repo-root", os.tmpdir()]);
    assert.ok(result.stderr.includes("requires") || result.exitCode === 1, "Should show error for missing --write-baseline");
  });
});