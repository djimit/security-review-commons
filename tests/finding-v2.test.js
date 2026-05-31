import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeFinding } from "../src/core/findings.js";

describe("makeFinding v2", () => {
  const baseInput = {
    title: "Test finding",
    severity: "high",
    confidence: "high",
    category: "secret-exposure",
    files: ["src/index.js"],
    explanation: "Test explanation",
    source: { ruleId: "test-rule", layer: "audit" }
  };

  it("provides v2 default fields", () => {
    const finding = makeFinding(baseInput);
    assert.equal(finding.detectionMethod, "pattern");
    assert.equal(finding.falsePositiveRisk, "medium");
    assert.equal(finding.remediationEffort, "medium");
    assert.deepEqual(finding.complianceMapping, []);
    assert.equal(finding.evidence, null);
  });

  it("accepts explicit v2 fields", () => {
    const finding = makeFinding({
      ...baseInput,
      detectionMethod: "entropy",
      falsePositiveRisk: "low",
      remediationEffort: "high",
      complianceMapping: [
        { framework: "BIO2", control: "B.03", title: "Identiteitsbeheer", severity: "high" }
      ],
      evidence: { snippet: "AKIA****1234", startLine: 42, endLine: 42, masked: true }
    });
    assert.equal(finding.detectionMethod, "entropy");
    assert.equal(finding.falsePositiveRisk, "low");
    assert.equal(finding.remediationEffort, "high");
    assert.equal(finding.complianceMapping.length, 1);
    assert.equal(finding.complianceMapping[0].framework, "BIO2");
    assert.equal(finding.evidence.snippet, "AKIA****1234");
    assert.equal(finding.evidence.masked, true);
  });

  it("preserves v1 fields for backward compatibility", () => {
    const finding = makeFinding(baseInput);
    assert.equal(typeof finding.id, "string");
    assert.equal(finding.title, "Test finding");
    assert.equal(finding.severity, "high");
    assert.equal(finding.confidence, "high");
    assert.equal(finding.category, "secret-exposure");
    assert.deepEqual(finding.files, ["src/index.js"]);
    assert.equal(finding.explanation, "Test explanation");
    assert.equal(finding.source.ruleId, "test-rule");
  });

  it("accepts info severity", () => {
    const finding = makeFinding({ ...baseInput, severity: "info" });
    assert.equal(finding.severity, "info");
  });
});