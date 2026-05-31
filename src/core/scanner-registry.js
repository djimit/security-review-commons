import { BUILTIN_RULES } from "./rules.js";
import { REPO_AUDIT_PATTERNS } from "./repo-audit.js";

const rules = new Map();
let idCounter = 0;

function registerRule(rule) {
  if (!rule.id) {
    rule.id = `custom-${++idCounter}`;
  }
  if (!rule.scanner) {
    rule.scanner = "pattern";
  }
  if (!rule.detectionMethod) {
    rule.detectionMethod = rule.scanner;
  }
  if (!rule.falsePositiveRisk) {
    rule.falsePositiveRisk = "medium";
  }
  if (!rule.remediationEffort) {
    rule.remediationEffort = "medium";
  }
  if (!rule.complianceMapping) {
    rule.complianceMapping = [];
  }
  rules.set(rule.id, rule);
  return rule;
}

function getRule(id) {
  return rules.get(id) ?? null;
}

function getRules(options = {}) {
  const { scanner, category, language } = options;
  let result = Array.from(rules.values());
  if (scanner) {
    result = result.filter((r) => r.scanner === scanner);
  }
  if (category) {
    result = result.filter((r) => r.category === category);
  }
  if (language) {
    result = result.filter((r) => !r.language || r.language === language);
  }
  return result;
}

function clearRules() {
  rules.clear();
  idCounter = 0;
}

function resetRegistry() {
  clearRules();
  loadBuiltinRules(BUILTIN_RULES);
  loadBuiltinRules(REPO_AUDIT_PATTERNS);
}

function loadBuiltinRules(builtinRules) {
  for (const rule of builtinRules) {
    registerRule(rule);
  }
}

loadBuiltinRules(BUILTIN_RULES);
loadBuiltinRules(REPO_AUDIT_PATTERNS);

export { registerRule, getRule, getRules, clearRules, resetRegistry, loadBuiltinRules };