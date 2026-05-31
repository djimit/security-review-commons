import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSuppressions, validateSuppressionGovernance, applySuppressions } from "../src/core/suppressions.js";
import { makeFinding } from "../src/core/findings.js";

function makeAuditFinding(ruleId, file, line, severity = "medium") {
  return makeFinding({
    title: `Finding for ${ruleId}`,
    severity,
    category: "secret-exposure",
    files: [file],
    explanation: "test finding",
    proposedFix: "remove it",
    source: { ruleId, layer: "audit" },
    location: { file, line }
  });
}

describe("suppression-lifecycle-audit", () => {
  describe("suppression with mode audit", () => {
    it("suppresses findings matching ruleId in audit mode", () => {
      const findings = [makeAuditFinding("no-hardcoded-secrets", "src/app.js", 10)];
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", owner: "admin@test.com", justification: "false positive in test config", expiresOn: "2099-01-01" }
      ]);
      const { activeFindings, suppressedFindings } = applySuppressions(findings, suppressions, { mode: "audit" });
      assert.equal(activeFindings.length, 0, "Should suppress matching finding in audit mode");
      assert.equal(suppressedFindings.length, 1);
    });

    it("does not suppress non-matching findings", () => {
      const findings = [makeAuditFinding("no-hardcoded-secrets", "src/app.js", 10)];
      const suppressions = normalizeSuppressions([
        { ruleId: "different-rule", owner: "admin@test.com", justification: "not matching rule", expiresOn: "2099-01-01" }
      ]);
      const { activeFindings, suppressedFindings } = applySuppressions(findings, suppressions, { mode: "audit" });
      assert.equal(activeFindings.length, 1);
      assert.equal(suppressedFindings.length, 0);
    });

    it("suppresses in both modes when scope is file (default)", () => {
      const findings = [makeAuditFinding("no-hardcoded-secrets", "src/app.js", 10)];
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", owner: "admin@test.com", justification: "accepted risk for this file", expiresOn: "2099-01-01" }
      ]);
      const auditResult = applySuppressions(findings, suppressions, { mode: "audit" });
      const reviewResult = applySuppressions(findings, suppressions, { mode: "review" });
      assert.equal(auditResult.activeFindings.length, 0, "Should suppress in audit mode");
      assert.equal(reviewResult.activeFindings.length, 0, "Should suppress in review mode");
    });
  });

  describe("path-scoped suppression", () => {
    it("suppresses findings matching path scope", () => {
      const findings = [makeAuditFinding("no-hardcoded-secrets", "test/fixtures/mock.env", 5)];
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", pathRegex: "test/fixtures/.*", owner: "admin@test.com", justification: "test fixture mock data", expiresOn: "2099-01-01" }
      ]);
      const { activeFindings, suppressedFindings } = applySuppressions(findings, suppressions, { mode: "audit" });
      assert.equal(activeFindings.length, 0);
      assert.equal(suppressedFindings.length, 1);
    });

    it("does not suppress findings not matching path scope", () => {
      const findings = [makeAuditFinding("no-hardcoded-secrets", "src/app.js", 10)];
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", pathRegex: "test/fixtures/.*", owner: "admin@test.com", justification: "test fixture mock data", expiresOn: "2099-01-01" }
      ]);
      const { activeFindings } = applySuppressions(findings, suppressions, { mode: "audit" });
      assert.equal(activeFindings.length, 1, "Should not suppress when path does not match");
    });
  });

  describe("repository-scoped suppression", () => {
    it("suppresses findings with scope repository in audit mode", () => {
      const findings = [makeAuditFinding("no-hardcoded-secrets", "src/app.js", 10)];
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", owner: "admin@test.com", justification: "accepted risk across repository", expiresOn: "2099-01-01", scope: "repository" }
      ]);
      const { activeFindings, suppressedFindings } = applySuppressions(findings, suppressions, { mode: "audit" });
      assert.equal(activeFindings.length, 0);
      assert.equal(suppressedFindings.length, 1);
    });

    it("does not apply repository scope in review mode", () => {
      const findings = [makeAuditFinding("no-hardcoded-secrets", "src/app.js", 10)];
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", owner: "admin@test.com", justification: "accepted risk", expiresOn: "2099-01-01", scope: "repository" }
      ]);
      const { activeFindings } = applySuppressions(findings, suppressions, { mode: "review" });
      assert.equal(activeFindings.length, 1, "Repository scope should not suppress in review mode");
    });

    it("repository scope suppresses same rule across all files in audit mode", () => {
      const findings = [
        makeAuditFinding("no-hardcoded-secrets", "src/app.js", 10),
        makeAuditFinding("no-hardcoded-secrets", "src/config.js", 20)
      ];
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", owner: "admin@test.com", justification: "accepted risk repository-wide", expiresOn: "2099-01-01", scope: "repository" }
      ]);
      const { activeFindings } = applySuppressions(findings, suppressions, { mode: "audit" });
      assert.equal(activeFindings.length, 0, "Repository scope should suppress across all files");
    });
  });

  describe("expired suppression", () => {
    it("does not suppress findings with expired suppression", () => {
      const findings = [makeAuditFinding("no-hardcoded-secrets", "src/app.js", 10)];
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", owner: "admin@test.com", justification: "old suppression that expired", expiresOn: "2020-01-01" }
      ]);
      const { activeFindings, suppressedFindings } = applySuppressions(findings, suppressions, { mode: "audit" });
      assert.equal(activeFindings.length, 1, "Expired suppression should not suppress");
      assert.equal(suppressedFindings.length, 0);
    });
  });

  describe("governance validation", () => {
    it("detects expired suppressions", () => {
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", owner: "admin@test.com", justification: "expired suppression", expiresOn: "2020-01-01", approvedBy: "lead", ticket: "SEC-1", createdOn: "2020-01-01" }
      ]);
      const violations = validateSuppressionGovernance(suppressions);
      assert.ok(violations.length >= 1, "Should detect expired suppression");
      assert.equal(violations[0].kind, "expired");
    });

    it("detects missing required metadata for governance", () => {
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", owner: "admin@test.com", justification: "a suppression without governance metadata", expiresOn: "2099-01-01" }
      ]);
      const violations = validateSuppressionGovernance(suppressions);
      assert.ok(violations.length >= 1, "Should detect missing metadata");
      assert.equal(violations[0].kind, "missing-metadata");
    });

    it("reports no violations for well-formed suppressions", () => {
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", owner: "admin@test.com", justification: "low severity accepted risk", expiresOn: "2099-01-01", approvedBy: "security-lead", ticket: "SEC-100", createdOn: "2024-01-01" }
      ]);
      const violations = validateSuppressionGovernance(suppressions);
      const expired = violations.filter(v => v.kind === "expired");
      assert.equal(expired.length, 0, "Should have no expired violations");
    });
  });

  describe("lifecycle reporting", () => {
    it("reports which findings are suppressed and with justification", () => {
      const findings = [
        makeAuditFinding("no-hardcoded-secrets", "src/app.js", 10),
        makeAuditFinding("no-weak-tls", "src/config.js", 20)
      ];
      const suppressions = normalizeSuppressions([
        { ruleId: "no-hardcoded-secrets", owner: "admin@test.com", justification: "false positive in config", expiresOn: "2099-01-01" }
      ]);
      const { activeFindings, suppressedFindings } = applySuppressions(findings, suppressions, { mode: "audit" });
      assert.equal(activeFindings.length, 1, "One finding should remain active");
      assert.equal(suppressedFindings.length, 1, "One finding should be suppressed");
      assert.equal(suppressedFindings[0].suppression.justification, "false positive in config");
    });
  });
});