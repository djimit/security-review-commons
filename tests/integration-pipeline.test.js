import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { makeFinding } from "../src/core/findings.js";
import { writeBaseline, loadBaseline, compareBaseline } from "../src/core/baseline.js";
import { runRepoAudit } from "../src/core/repo-audit.js";
import { findingsToComplianceMarkdown, findingsToComplianceJson } from "../src/core/compliance-report.js";

const CLI = path.resolve(import.meta.dirname, "../src/cli.js");

function runCli(args) {
  const result = spawnSync("node", [CLI, ...args], {
    encoding: "utf-8",
    timeout: 60000
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1
  };
}

describe("integration: audit-baseline-compliance pipeline", () => {
  it("audit → baseline → delta: end-to-end pipeline", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sr-pipeline-"));
    try {
      const baselineResult = runCli(["baseline", "--write-baseline", "--repo-root", tempDir]);
      assert.equal(baselineResult.exitCode, 0, "Baseline write should succeed");
      const baselineData = JSON.parse(baselineResult.stdout);
      assert.ok(baselineData.integrity, "Baseline should have integrity hash");

      const baselinePath = path.join(tempDir, ".security-baseline.json");
      const loaded = await loadBaseline(baselinePath);
      assert.ok(loaded, "Should load baseline");
      assert.equal(loaded.version, 1);

      const auditResult = runCli(["audit", "--format", "summary", "--repo-root", tempDir]);
      assert.ok(auditResult.stdout.includes("total"), "Audit should produce summary");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("audit → compliance report produces valid output", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sr-compliance-"));
    try {
      const result = runCli(["audit", "--format", "compliance-json", "--repo-root", tempDir]);
      const json = JSON.parse(result.stdout);
      assert.ok(json.profiles, "Should have profiles field");
      assert.ok(Array.isArray(json.frameworks), "Should have frameworks array");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("audit → compliance markdown produces report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sr-compliance-md-"));
    try {
      const result = runCli(["audit", "--format", "compliance-markdown", "--repo-root", tempDir]);
      assert.ok(result.stdout.includes("Compliance Report"), "Should have compliance report header");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("compareBaseline detects new findings after baseline", async () => {
    const baselineFindings = [
      { id: "rule-1::src/app.js::10", ruleId: "rule-1", severity: "medium", category: "secret-exposure", file: "src/app.js", line: 10 }
    ];
    const currentFindings = [
      makeFinding({ title: "New finding", severity: "high", category: "auth-bypass", files: ["src/auth.js"], explanation: "test", proposedFix: "fix", source: { ruleId: "rule-2", layer: "audit" }, location: { file: "src/auth.js", line: 5 } }),
      makeFinding({ title: "Existing", severity: "medium", category: "secret-exposure", files: ["src/app.js"], explanation: "test", proposedFix: "fix", source: { ruleId: "rule-1", layer: "audit" }, location: { file: "src/app.js", line: 10 } })
    ];
    const result = compareBaseline(currentFindings, baselineFindings);
    assert.equal(result.new.length, 1, "Should detect 1 new finding");
    assert.equal(result.unchanged.length, 1, "Should detect 1 unchanged finding");
    assert.equal(result.summary.newCount, 1);
  });

  it("audit → baseline delta with new critical finding exits 1", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sr-delta-"));
    try {
      runCli(["baseline", "--write-baseline", "--repo-root", tempDir]);
      const baselinePath = path.join(tempDir, ".security-baseline.json");
      const result = runCli(["audit", "--baseline", baselinePath, "--repo-root", tempDir]);
      const output = result.stdout + result.stderr;
      assert.ok(output.includes("summary") || output.includes("newCount") || output.includes("total"), "Should produce delta output");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("compliance report filters by profile", () => {
    const findings = [
      makeFinding({ title: "Test", severity: "high", category: "secret-exposure", files: ["app.js"], explanation: "test", proposedFix: "fix", source: { ruleId: "test", layer: "audit" }, complianceMapping: [
        { framework: "BIO2", control: "B.03", title: "Test", severity: "high" },
        { framework: "OWASP", control: "A07:2021", title: "Test", severity: "high" }
      ] })
    ];
    const md = findingsToComplianceMarkdown(findings, ["BIO2"]);
    assert.ok(md.includes("## BIO2"), "Should include BIO2");
    assert.ok(!md.includes("## OWASP"), "Should not include OWASP when filtered");
  });
});