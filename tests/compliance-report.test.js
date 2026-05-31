import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeFinding } from "../src/core/findings.js";
import { findingsToComplianceMarkdown, findingsToComplianceJson } from "../src/core/compliance-report.js";
import { getRules } from "../src/core/scanner-registry.js";
import { REPO_AUDIT_PATTERNS } from "../src/core/repo-audit.js";
import { CATEGORY_COMPLIANCE_MAP, getComplianceMappingForCategory } from "../src/core/compliance-data.js";

const BIO2_FINDING = makeFinding({
  title: "Test secret",
  severity: "high",
  category: "secret-exposure",
  files: ["src/app.js"],
  explanation: "test",
  proposedFix: "test",
  source: { ruleId: "test-rule", layer: "audit" },
  complianceMapping: [
    { framework: "BIO2", control: "B.03", title: "Identiteitsbeheer", severity: "high" },
    { framework: "NORA", control: "IR.05", title: "Informatiebeveiliging", severity: "high" }
  ]
});

const NORA_FINDING = makeFinding({
  title: "Test bypass",
  severity: "medium",
  category: "security-bypass",
  files: ["src/config.js"],
  explanation: "test",
  proposedFix: "test",
  source: { ruleId: "test-rule-2", layer: "audit" },
  complianceMapping: [
    { framework: "NORA", control: "IR.08", title: "Beveiligingsmaatregelen", severity: "medium" }
  ]
});

const UNMAPPED_FINDING = makeFinding({
  title: "Unknown issue",
  severity: "low",
  category: "configuration",
  files: ["src/util.js"],
  explanation: "test",
  proposedFix: "test",
  source: { ruleId: "test-rule-3", layer: "audit" }
});

describe("compliance-report", () => {
  describe("findingsToComplianceMarkdown", () => {
    it("groups findings by framework and control", () => {
      const md = findingsToComplianceMarkdown([BIO2_FINDING, NORA_FINDING], []);
      assert.ok(md.includes("# Compliance Report"), "Should have header");
      assert.ok(md.includes("## BIO2"), "Should have BIO2 section");
      assert.ok(md.includes("## NORA"), "Should have NORA section");
      assert.ok(md.includes("B.03"), "Should have B.03 control");
      assert.ok(md.includes("IR.08"), "Should have IR.08 control");
    });

    it("filters by profile", () => {
      const md = findingsToComplianceMarkdown([BIO2_FINDING], ["BIO2"]);
      assert.ok(md.includes("## BIO2"), "Should include BIO2");
      assert.ok(!md.includes("## NORA"), "Should not include NORA");
      assert.ok(md.includes("Profiles: BIO2"), "Should show active profile");
    });

    it("handles empty findings", () => {
      const md = findingsToComplianceMarkdown([], []);
      assert.ok(md.includes("No compliance findings"), "Should report no findings");
    });

    it("places unmapped findings under Uncategorized", () => {
      const md = findingsToComplianceMarkdown([UNMAPPED_FINDING], []);
      assert.ok(md.includes("## Uncategorized"), "Should have Uncategorized section");
    });

    it("includes severity in output", () => {
      const md = findingsToComplianceMarkdown([BIO2_FINDING], []);
      assert.ok(md.includes("[HIGH]"), "Should include severity");
    });
  });

  describe("findingsToComplianceJson", () => {
    it("produces structured compliance JSON", () => {
      const json = findingsToComplianceJson([BIO2_FINDING, NORA_FINDING], []);
      assert.equal(json.profiles, "all", "Should default to all profiles");
      assert.equal(json.totalFindings, 2, "Should count all findings");
      assert.ok(json.frameworks.length >= 2, "Should have at least 2 frameworks");
    });

    it("filters by profile", () => {
      const json = findingsToComplianceJson([BIO2_FINDING, NORA_FINDING], ["BIO2"]);
      assert.deepEqual(json.profiles, ["BIO2"], "Should show BIO2 profile");
      const bio2Framework = json.frameworks.find((f) => f.framework === "BIO2");
      assert.ok(bio2Framework, "Should include BIO2 framework");
      const noraFramework = json.frameworks.find((f) => f.framework === "NORA");
      assert.ok(!noraFramework, "Should not include NORA framework");
    });

    it("includes detection method", () => {
      const json = findingsToComplianceJson([BIO2_FINDING], []);
      const finding = json.frameworks[0].controls[0].findings[0];
      assert.equal(finding.detectionMethod, "pattern", "Should default to pattern");
    });

    it("handles empty findings", () => {
      const json = findingsToComplianceJson([], []);
      assert.equal(json.totalFindings, 0);
      assert.equal(json.frameworks.length, 0);
    });

    it("handles unmapped findings under Uncategorized", () => {
      const json = findingsToComplianceJson([UNMAPPED_FINDING], []);
      assert.ok(json.frameworks.some((f) => f.framework === "Uncategorized"), "Should have Uncategorized");
    });
  });

  describe("compliance mapping coverage", () => {
    it("all builtin rules have compliance mapping", () => {
      const rules = getRules();
      const withoutMapping = rules.filter((r) => !r.complianceMapping || r.complianceMapping.length === 0);
      assert.equal(withoutMapping.length, 0, `Rules without mapping: ${withoutMapping.map((r) => r.id).join(", ")}`);
    });

    it("all audit patterns have compliance mapping", () => {
      const withoutMapping = REPO_AUDIT_PATTERNS.filter((r) => !r.complianceMapping || r.complianceMapping.length === 0);
      assert.equal(withoutMapping.length, 0, `Audit patterns without mapping: ${withoutMapping.map((r) => r.id).join(", ")}`);
    });

    it("compliance data covers all expected frameworks", () => {
      const categories = Object.keys(CATEGORY_COMPLIANCE_MAP);
      assert.ok(categories.length >= 12, `Expected 12+ categories, got ${categories.length}`);
      for (const [cat, mappings] of Object.entries(CATEGORY_COMPLIANCE_MAP)) {
        const frameworks = new Set(mappings.map((m) => m.framework));
        assert.ok(frameworks.size >= 4, `${cat} should map to 4+ frameworks, got ${frameworks.size}`);
      }
    });

    it("getComplianceMappingForCategory returns valid mappings", () => {
      const mappings = getComplianceMappingForCategory("secret-exposure");
      assert.ok(mappings.length >= 4, "secret-exposure should have 4+ mappings");
      assert.ok(mappings.some((m) => m.framework === "BIO2"), "Should include BIO2");
      assert.ok(mappings.some((m) => m.framework === "OWASP"), "Should include OWASP");
    });

    it("getComplianceMappingForCategory returns default for unknown category", () => {
      const mappings = getComplianceMappingForCategory("nonexistent");
      assert.ok(mappings.length >= 1, "Should return default mapping for unknown categories");
    });
  });
});