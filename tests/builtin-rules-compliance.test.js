import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BUILTIN_RULES } from "../src/core/rules.js";

describe("builtin-rules compliance mapping", () => {
  it("every builtin rule has complianceMapping with at least 1 entry", () => {
    for (const rule of BUILTIN_RULES) {
      assert.ok(rule.complianceMapping, `Rule ${rule.id} missing complianceMapping`);
      assert.ok(rule.complianceMapping.length >= 1, `Rule ${rule.id} has empty complianceMapping`);
    }
  });

  it("every compliance mapping entry has required fields", () => {
    for (const rule of BUILTIN_RULES) {
      for (const mapping of rule.complianceMapping) {
        assert.ok(mapping.framework, `Rule ${rule.id} has mapping without framework`);
        assert.ok(mapping.control, `Rule ${rule.id} has mapping without control`);
        assert.ok(mapping.title, `Rule ${rule.id} has mapping without title`);
        assert.ok(mapping.severity, `Rule ${rule.id} has mapping without severity`);
      }
    }
  });

  it("every builtin rule has scanner, detectionMethod, falsePositiveRisk, remediationEffort", () => {
    for (const rule of BUILTIN_RULES) {
      assert.ok(rule.scanner, `Rule ${rule.id} missing scanner`);
      assert.ok(rule.detectionMethod, `Rule ${rule.id} missing detectionMethod`);
      assert.ok(["pattern", "entropy", "ast"].includes(rule.detectionMethod), `Rule ${rule.id} has invalid detectionMethod: ${rule.detectionMethod}`);
      assert.ok(["low", "medium", "high"].includes(rule.falsePositiveRisk), `Rule ${rule.id} has invalid falsePositiveRisk: ${rule.falsePositiveRisk}`);
      assert.ok(["low", "medium", "high"].includes(rule.remediationEffort), `Rule ${rule.id} has invalid remediationEffort: ${rule.remediationEffort}`);
    }
  });

  it("secret-exposure rules map to BIO2 B.03", () => {
    const secretRules = BUILTIN_RULES.filter((r) => r.category === "secret-exposure");
    for (const rule of secretRules) {
      const bio2 = rule.complianceMapping.find((m) => m.framework === "BIO2");
      assert.ok(bio2, `Rule ${rule.id} missing BIO2 mapping`);
      assert.equal(bio2.control, "B.03", `Rule ${rule.id} BIO2 mapping should be B.03, got ${bio2.control}`);
    }
  });

  it("security-bypass rules map to OWASP A02", () => {
    const bypassRules = BUILTIN_RULES.filter((r) => r.category === "security-bypass");
    for (const rule of bypassRules) {
      const owasp = rule.complianceMapping.find((m) => m.framework === "OWASP");
      assert.ok(owasp, `Rule ${rule.id} missing OWASP mapping`);
      assert.ok(owasp.control.startsWith("A02"), `Rule ${rule.id} OWASP mapping should be A02, got ${owasp.control}`);
    }
  });
});