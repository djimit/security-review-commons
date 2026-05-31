import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerRule, getRule, getRules, clearRules, resetRegistry, loadBuiltinRules } from "../src/core/scanner-registry.js";

describe("scanner-registry", () => {
  beforeEach(() => {
    clearRules();
  });

  it("registers a pattern rule and retrievesves it by id", () => {
    const rule = registerRule({
      id: "test-pattern-1",
      title: "Test pattern rule",
      severity: "high",
      category: "secret-exposure",
      scanner: "pattern",
      regex: /test-pattern/,
      complianceMapping: [{ framework: "BIO2", control: "B.03", title: "Test", severity: "high" }]
    });
    assert.equal(rule.id, "test-pattern-1");
    const retrieved = getRule("test-pattern-1");
    assert.equal(retrieved.title, "Test pattern rule");
    assert.equal(retrieved.scanner, "pattern");
  });

  it("registers an entropy rule", () => {
    const rule = registerRule({
      id: "test-entropy-1",
      title: "Test entropy rule",
      severity: "medium",
      category: "secret-exposure",
      scanner: "entropy",
      entropyThreshold: 4.5,
      complianceMapping: []
    });
    assert.equal(rule.scanner, "entropy");
    assert.equal(rule.detectionMethod, "entropy");
  });

  it("defaults scanner to pattern and detectionMethod to scanner", () => {
    const rule = registerRule({
      id: "test-defaults",
      title: "Defaults test",
      severity: "low",
      category: "info",
      regex: /test/
    });
    assert.equal(rule.scanner, "pattern");
    assert.equal(rule.detectionMethod, "pattern");
  });

  it("defaults falsePositiveRisk, remediationEffort, and complianceMapping", () => {
    const rule = registerRule({
      id: "test-defaults-v2",
      title: "V2 defaults test",
      severity: "medium",
      category: "security-bypass",
      regex: /test/
    });
    assert.equal(rule.falsePositiveRisk, "medium");
    assert.equal(rule.remediationEffort, "medium");
    assert.deepEqual(rule.complianceMapping, []);
  });

  it("filters rules by scanner type", () => {
    registerRule({ id: "p1", title: "Pattern 1", severity: "high", category: "test", scanner: "pattern", regex: /a/ });
    registerRule({ id: "e1", title: "Entropy 1", severity: "medium", category: "test", scanner: "entropy", entropyThreshold: 4.5 });
    const patternRules = getRules({ scanner: "pattern" });
    const entropyRules = getRules({ scanner: "entropy" });
    assert.equal(patternRules.length, 1);
    assert.equal(entropyRules.length, 1);
    assert.equal(patternRules[0].id, "p1");
  });

  it("filters rules by category", () => {
    registerRule({ id: "s1", title: "Secret", severity: "high", category: "secret-exposure", scanner: "pattern", regex: /a/ });
    registerRule({ id: "b1", title: "Bypass", severity: "high", category: "security-bypass", scanner: "pattern", regex: /b/ });
    const secrets = getRules({ category: "secret-exposure" });
    assert.equal(secrets.length, 1);
    assert.equal(secrets[0].id, "s1");
  });

  it("filters rules by language", () => {
    registerRule({ id: "js1", title: "JS Rule", severity: "high", category: "test", scanner: "pattern", language: "javascript", regex: /a/ });
    registerRule({ id: "any1", title: "Any Rule", severity: "high", category: "test", scanner: "pattern", regex: /b/ });
    const jsRules = getRules({ language: "javascript" });
    assert.equal(jsRules.length, 2);
    const pyRules = getRules({ language: "python" });
    assert.equal(pyRules.length, 1);
    assert.equal(pyRules[0].id, "any1");
  });

  it("clears all rules", () => {
    registerRule({ id: "c1", title: "Clear test", severity: "low", category: "test", regex: /a/ });
    assert.equal(getRules().length, 1);
    clearRules();
    assert.equal(getRules().length, 0);
  });

  it("loads builtin rules from an array", () => {
    const builtins = [
      { id: "builtin-1", title: "Builtin 1", severity: "high", category: "test", regex: /a/ },
      { id: "builtin-2", title: "Builtin 2", severity: "medium", category: "test", regex: /b/ }
    ];
    loadBuiltinRules(builtins);
    assert.equal(getRules().length, 2);
    assert.ok(getRule("builtin-1"));
    assert.ok(getRule("builtin-2"));
  });

  it("generates id for rules without one", () => {
    const rule = registerRule({ title: "Auto ID", severity: "low", category: "test", regex: /x/ });
    assert.equal(rule.id.startsWith("custom-"), true);
  });

  it("replaces existing rule with same id", () => {
    registerRule({ id: "dup", title: "First", severity: "low", category: "test", regex: /a/ });
    registerRule({ id: "dup", title: "Second", severity: "high", category: "test", regex: /b/ });
    const rule = getRule("dup");
    assert.equal(rule.title, "Second");
    assert.equal(getRules().length, 1);
  });

  it("filters rules by both scanner and category", () => {
    registerRule({ id: "sp1", title: "Pattern Secret", severity: "high", category: "secret-exposure", scanner: "pattern", regex: /a/ });
    registerRule({ id: "ep1", title: "Entropy Secret", severity: "medium", category: "secret-exposure", scanner: "entropy", entropyThreshold: 4.5 });
    registerRule({ id: "sp2", title: "Pattern Bypass", severity: "high", category: "security-bypass", scanner: "pattern", regex: /b/ });
    const results = getRules({ scanner: "pattern", category: "secret-exposure" });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, "sp1");
  });

  it("returns null for nonexistent rule id", () => {
    assert.equal(getRule("nonexistent-rule-id"), null);
  });

  it("handles pathRegex filtering", () => {
    registerRule({ id: "env1", title: "Env rule", severity: "high", category: "secret-exposure", scanner: "pattern", regex: /secret/, pathRegex: /\.env$/ });
    registerRule({ id: "any2", title: "Any file rule", severity: "medium", category: "test", scanner: "pattern", regex: /test/ });
    const envRules = getRules({ pathRegex: ".env" });
    assert.ok(envRules.length >= 2, "Should match both specific and generic rules");
  });

  it("sets detectionMethod based on scanner type", () => {
    const pattern = registerRule({ id: "dm-p", title: "P", severity: "low", category: "test", scanner: "pattern", regex: /x/ });
    const entropy = registerRule({ id: "dm-e", title: "E", severity: "low", category: "test", scanner: "entropy" });
    assert.equal(pattern.detectionMethod, "pattern");
    assert.equal(entropy.detectionMethod, "entropy");
  });

  it("preserves complianceMapping when provided", () => {
    const mapping = [
      { framework: "BIO2", control: "B.03", title: "Access control", severity: "high" },
      { framework: "OWASP", control: "A07:2021", title: "Auth failures", severity: "high" }
    ];
    registerRule({ id: "cm1", title: "CM Test", severity: "high", category: "secret-exposure", scanner: "pattern", regex: /x/, complianceMapping: mapping });
    const rule = getRule("cm1");
    assert.equal(rule.complianceMapping.length, 2);
    assert.equal(rule.complianceMapping[0].framework, "BIO2");
  });

  it("does not load builtin rules twice", () => {
    const builtins = [
      { id: "b1", title: "B1", severity: "high", category: "test", regex: /a/ }
    ];
    loadBuiltinRules(builtins);
    loadBuiltinRules(builtins);
    assert.equal(getRules().length, 1, "Should not duplicate builtin rules");
  });

  it("resetRegistry restores builtin rules after clear", () => {
    loadBuiltinRules([{ id: "rb1", title: "RB1", severity: "high", category: "test", regex: /a/ }]);
    assert.ok(getRules().length >= 1);
    clearRules();
    assert.equal(getRules().length, 0);
    resetRegistry();
    assert.ok(getRules().length >= 1, "Should restore builtin rules");
  });

  it("handles rule with all optional fields", () => {
    const rule = registerRule({
      id: "full-rule",
      title: "Full rule",
      severity: "critical",
      category: "secret-exposure",
      scanner: "pattern",
      regex: /full-test/,
      pathRegex: /\.env$/,
      language: "javascript",
      falsePositiveRisk: "low",
      remediationEffort: "low",
      complianceMapping: [{ framework: "ISO27001", control: "A.8.9", title: "Access control", severity: "high" }]
    });
    assert.ok(rule.pathRegex instanceof RegExp, "pathRegex should be a RegExp");
    assert.equal(rule.language, "javascript");
    assert.equal(rule.falsePositiveRisk, "low");
    assert.equal(rule.remediationEffort, "low");
    assert.equal(rule.complianceMapping.length, 1);
  });

  it("supports AST scanner type", () => {
    const rule = registerRule({
      id: "ast1",
      title: "AST rule",
      severity: "medium",
      category: "code-injection",
      scanner: "ast",
      detectionMethod: "ast"
    });
    assert.equal(rule.scanner, "ast");
    assert.equal(rule.detectionMethod, "ast");
  });

  it("getRules with no filters returns all rules", () => {
    registerRule({ id: "f1", title: "F1", severity: "high", category: "test", scanner: "pattern", regex: /a/ });
    registerRule({ id: "f2", title: "F2", severity: "medium", category: "test", scanner: "entropy" });
    assert.equal(getRules().length, 2);
  });

  it("clears and re-registers rules independently", () => {
    registerRule({ id: "ind1", title: "I1", severity: "low", category: "test", regex: /x/ });
    clearRules();
    registerRule({ id: "ind2", title: "I2", severity: "medium", category: "test", regex: /y/ });
    assert.equal(getRules().length, 1);
    assert.equal(getRule("ind1"), null);
    assert.ok(getRule("ind2"));
  });
});