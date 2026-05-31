import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  writeBaseline,
  loadBaseline,
  compareBaseline,
  checkGitignoreAwareness,
  findingIdentity,
  computeIntegrity,
  BASELINE_FILENAME,
  BASELINE_VERSION
} from "../src/core/baseline.js";
import { makeFinding } from "../src/core/findings.js";

function makeTestFinding(ruleId, file, line, severity = "medium") {
  return makeFinding({
    title: `Test finding ${ruleId}`,
    severity,
    category: "secret-exposure",
    files: [file],
    explanation: "test",
    proposedFix: "test",
    source: { ruleId, layer: "audit" },
    location: { file, line }
  });
}

describe("baseline", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sr-baseline-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("writeBaseline", () => {
    it("writes a baseline file with correct structure", async () => {
      const findings = [
        makeTestFinding("rule-1", "src/app.js", 10),
        makeTestFinding("rule-2", "src/config.js", 25, "high")
      ];
      const result = await writeBaseline(findings, {}, tempDir);
      assert.ok(result.path.endsWith(BASELINE_FILENAME), "Should write to baseline filename");
      assert.equal(result.count, 2, "Should count all findings");
      assert.ok(result.integrity, "Should include integrity hash");

      const raw = fs.readFileSync(result.path, "utf-8");
      const baseline = JSON.parse(raw);
      assert.equal(baseline.version, BASELINE_VERSION);
      assert.equal(baseline.findings.length, 2);
      assert.ok(baseline.integrity, "Should have integrity field");
    });

    it("includes metadata in baseline", async () => {
      const config = { version: "1.2.3", rules: [1, 2, 3], _hash: "abc123" };
      const result = await writeBaseline([], config, tempDir);
      const raw = fs.readFileSync(result.path, "utf-8");
      const baseline = JSON.parse(raw);
      assert.equal(baseline.metadata.scannerVersion, "1.2.3");
      assert.equal(baseline.metadata.ruleCount, 3);
      assert.equal(baseline.metadata.configHash, "abc123");
    });
  });

  describe("loadBaseline", () => {
    it("loads and validates a baseline", async () => {
      const findings = [makeTestFinding("rule-1", "src/app.js", 10)];
      await writeBaseline(findings, {}, tempDir);
      const baselinePath = path.join(tempDir, BASELINE_FILENAME);
      const loaded = await loadBaseline(baselinePath);
      assert.ok(loaded, "Should load baseline");
      assert.equal(loaded.findings.length, 1);
      assert.equal(loaded.findings[0].ruleId, "rule-1");
    });

    it("returns null for missing file", async () => {
      const loaded = await loadBaseline(path.join(tempDir, "nonexistent.json"));
      assert.equal(loaded, null);
    });

    it("throws on integrity mismatch", async () => {
      const findings = [makeTestFinding("rule-1", "src/app.js", 10)];
      await writeBaseline(findings, {}, tempDir);
      const baselinePath = path.join(tempDir, BASELINE_FILENAME);
      const raw = fs.readFileSync(baselinePath, "utf-8");
      const tampered = JSON.parse(raw);
      tampered.findings.push({ id: "tampered", ruleId: "fake" });
      fs.writeFileSync(baselinePath, JSON.stringify(tampered, null, 2));
      await assert.rejects(() => loadBaseline(baselinePath), /integrity check failed/);
    });
  });

  describe("compareBaseline", () => {
    it("classifies new, resolved, and unchanged findings", () => {
      const baseline = [
        { id: "rule-1::src/app.js::10", ruleId: "rule-1", severity: "medium", category: "secret-exposure", file: "src/app.js", line: 10 },
        { id: "rule-2::src/config.js::25", ruleId: "rule-2", severity: "high", category: "infrastructure-disclosure", file: "src/config.js", line: 25 }
      ];
      const current = [
        makeTestFinding("rule-1", "src/app.js", 10),
        makeTestFinding("rule-3", "src/new.js", 5, "low")
      ];
      const result = compareBaseline(current, baseline);
      assert.equal(result.new.length, 1, "Should find 1 new finding");
      assert.equal(result.resolved.length, 1, "Should find 1 resolved finding");
      assert.equal(result.unchanged.length, 1, "Should find 1 unchanged finding");
      assert.equal(result.summary.newCount, 1);
      assert.equal(result.summary.resolvedCount, 1);
      assert.equal(result.summary.unchangedCount, 1);
    });

    it("returns all as new when baseline is empty", () => {
      const current = [makeTestFinding("rule-1", "src/app.js", 10)];
      const result = compareBaseline(current, []);
      assert.equal(result.new.length, 1);
      assert.equal(result.resolved.length, 0);
      assert.equal(result.unchanged.length, 0);
    });

    it("returns all as resolved when current is empty", () => {
      const baseline = [{ id: "rule-1::src/app.js::10", ruleId: "rule-1", severity: "medium", category: "secret-exposure", file: "src/app.js", line: 10 }];
      const result = compareBaseline([], baseline);
      assert.equal(result.new.length, 0);
      assert.equal(result.resolved.length, 1);
    });
  });

  describe("checkGitignoreAwareness", () => {
    it("produces info finding when .gitignore is missing", async () => {
      const result = await checkGitignoreAwareness(tempDir);
      assert.equal(result.hasGitignore, false);
      assert.ok(result.finding, "Should produce finding");
      assert.equal(result.finding.severity, "info");
    });

    it("produces info finding when baseline file not in .gitignore", async () => {
      fs.writeFileSync(path.join(tempDir, ".gitignore"), "node_modules/\n");
      const result = await checkGitignoreAwareness(tempDir);
      assert.equal(result.hasGitignore, true);
      assert.equal(result.hasEntry, false);
      assert.ok(result.finding, "Should produce finding");
      assert.equal(result.finding.severity, "info");
    });

    it("returns no finding when baseline file is in .gitignore", async () => {
      fs.writeFileSync(path.join(tempDir, ".gitignore"), `node_modules/\n${BASELINE_FILENAME}\n`);
      const result = await checkGitignoreAwareness(tempDir);
      assert.equal(result.hasGitignore, true);
      assert.equal(result.hasEntry, true);
      assert.equal(result.finding, null);
    });

    it("matches wildcard pattern", async () => {
      fs.writeFileSync(path.join(tempDir, ".gitignore"), "node_modules/\n.security-baseline*\n");
      const result = await checkGitignoreAwareness(tempDir);
      assert.equal(result.hasEntry, true);
      assert.equal(result.finding, null);
    });
  });

  describe("findingIdentity", () => {
    it("creates stable identity from ruleId, file, and line", () => {
      const f = makeTestFinding("rule-1", "src/app.js", 10);
      const id = findingIdentity(f);
      assert.ok(id.includes("rule-1"));
      assert.ok(id.includes("src/app.js"));
    });

    it("produces same identity for same finding", () => {
      const f1 = makeTestFinding("rule-1", "src/app.js", 10);
      const f2 = makeTestFinding("rule-1", "src/app.js", 10);
      assert.equal(findingIdentity(f1), findingIdentity(f2));
    });
  });

  describe("computeIntegrity", () => {
    it("produces consistent SHA-256 hash", () => {
      const payload = { version: 1, findings: [] };
      const hash1 = computeIntegrity(payload);
      const hash2 = computeIntegrity(payload);
      assert.equal(hash1, hash2, "Same payload should produce same hash");
      assert.equal(hash1.length, 64, "SHA-256 should produce 64-char hex");
    });

    it("produces different hash for different payloads", () => {
      const hash1 = computeIntegrity({ version: 1 });
      const hash2 = computeIntegrity({ version: 2 });
      assert.notEqual(hash1, hash2);
    });
  });
});