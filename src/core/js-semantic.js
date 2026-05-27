import { makeFinding } from "./findings.js";

const JS_PATH_REGEX = /(^|\/).+\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i;
const TAINT_SOURCE_REGEX =
  /\b(?:req\.(?:body|query|params)|request\.(?:body|query|params)|ctx\.request\.(?:body|query|params)|userInput)\b/;

const JS_SEMANTIC_RULES = [
  {
    id: "semantic-js-exec-tainted-input",
    title: "Tainted input reaches command execution",
    severity: "high",
    category: "command-injection",
    sinkRegex: /\b(exec|execSync|spawn|spawnSync)\s*\(([^)]*)\)/,
    explanation:
      "A value derived from request-controlled input appears to reach command execution.",
    proposedFix:
      "Avoid shell or process execution on request-derived input; prefer allowlisted argv construction and strict validation."
  },
  {
    id: "semantic-js-eval-tainted-input",
    title: "Tainted input reaches eval-like execution",
    severity: "high",
    category: "code-injection",
    sinkRegex: /\b(eval|Function)\s*\(([^)]*)\)/,
    explanation:
      "A value derived from request-controlled input appears to reach dynamic code execution.",
    proposedFix:
      "Remove eval-like execution or isolate it behind a strict trusted-input boundary."
  },
  {
    id: "semantic-js-fetch-tainted-url",
    title: "Tainted input reaches outbound request target",
    severity: "medium",
    category: "ssrf",
    sinkRegex: /\b(fetch|got|request|axios\.(?:get|post|request))\s*\(([^)]*)\)/,
    explanation:
      "A value derived from request-controlled input appears to reach an outbound URL sink.",
    proposedFix:
      "Validate schemes, hosts, and destination allowlists before using request-derived URLs."
  },
  {
    id: "semantic-js-path-tainted-input",
    title: "Tainted input reaches filesystem path construction",
    severity: "medium",
    category: "path-traversal",
    sinkRegex: /\bpath\.(join|resolve)\s*\(([^)]*)\)/,
    explanation:
      "A value derived from request-controlled input appears to reach filesystem path construction.",
    proposedFix:
      "Normalize and bound the resulting path against a trusted root, or use an explicit allowlist."
  }
];

export function evaluateJsSemanticFindings({ diff, changedFiles, layer }) {
  if (!changedFiles.some((file) => JS_PATH_REGEX.test(file))) {
    return [];
  }

  const taintedIdentifiers = collectTaintedIdentifiers(diff);
  if (taintedIdentifiers.size === 0) {
    return [];
  }

  const findings = [];
  for (const rule of JS_SEMANTIC_RULES) {
    const match = rule.sinkRegex.exec(diff);
    if (!match) {
      continue;
    }
    const sinkArgs = match[2] ?? match[0];
    if (!containsTaintedIdentifier(sinkArgs, taintedIdentifiers)) {
      continue;
    }

    findings.push(
      makeFinding({
        title: rule.title,
        severity: rule.severity,
        confidence: "high",
        category: rule.category,
        files: changedFiles,
        explanation: rule.explanation,
        proposedFix: rule.proposedFix,
        source: { ruleId: rule.id, layer }
      })
    );
  }

  return findings;
}

function collectTaintedIdentifiers(diff) {
  const tainted = new Set();
  const lines = diff.split("\n");

  for (let pass = 0; pass < 3; pass += 1) {
    for (const line of lines) {
      const assignment =
        /\b(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s*=\s*(.+?);?\s*$/.exec(line);
      if (!assignment) {
        continue;
      }
      const [, identifier, value] = assignment;
      if (TAINT_SOURCE_REGEX.test(value) || referencesKnownTaint(value, tainted)) {
        tainted.add(identifier);
      }
    }
  }

  return tainted;
}

function referencesKnownTaint(value, taintedIdentifiers) {
  for (const identifier of taintedIdentifiers) {
    if (new RegExp(`\\b${escapeRegex(identifier)}\\b`).test(value)) {
      return true;
    }
  }
  return false;
}

function containsTaintedIdentifier(value, taintedIdentifiers) {
  return referencesKnownTaint(value, taintedIdentifiers);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

