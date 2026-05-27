import { makeFinding } from "./findings.js";

const BUILTIN_RULES = [
  {
    id: "builtin-dangerous-child-process-shell-true",
    title: "Shell execution with shell:true",
    severity: "high",
    category: "command-injection",
    regex: /\b(exec|spawn)\s*\([^)]*shell\s*:\s*true/i,
    explanation:
      "Using shell:true expands command-injection risk when any command fragment can be attacker-controlled.",
    proposedFix:
      "Prefer direct argv execution without a shell and validate all untrusted inputs before process execution."
  },
  {
    id: "builtin-path-join-user-input",
    title: "Potential path traversal via path join",
    severity: "medium",
    category: "path-traversal",
    regex: /\bpath\.(join|resolve)\s*\([^)]*(req\.|userInput|params\.|query\.)/i,
    explanation:
      "Joining attacker-controlled input into filesystem paths can allow traversal unless normalized and bounded.",
    proposedFix:
      "Validate allowed paths explicitly and enforce a trusted root after normalization."
  },
  {
    id: "builtin-hardcoded-secret-token",
    title: "Potential hardcoded credential",
    severity: "critical",
    category: "secret-exposure",
    regex: /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*['\"][^'\"]{8,}['\"]/i,
    explanation:
      "Hardcoded credentials are likely to leak through source control, logs, and downstream builds.",
    proposedFix:
      "Move the credential to a secret store or environment binding and rotate it."
  }
];

export function evaluatePatterns({ diff, changedFiles, layer, config }) {
  const findings = [];

  for (const rule of BUILTIN_RULES) {
    if (rule.regex.test(diff)) {
      findings.push(
        makeFinding({
          title: rule.title,
          severity: rule.severity,
          category: rule.category,
          files: changedFiles,
          explanation: rule.explanation,
          proposedFix: rule.proposedFix,
          source: { ruleId: rule.id, layer }
        })
      );
    }
  }

  for (const rule of config.customPatterns) {
    const pathMatch =
      !rule.compiledPathRegex ||
      changedFiles.some((path) => rule.compiledPathRegex.test(path));
    if (pathMatch && rule.compiledRegex.test(diff)) {
      findings.push(
        makeFinding({
          title: rule.title,
          severity: rule.severity,
          category: "custom-policy",
          files: changedFiles,
          explanation: `Custom additive policy matched pattern ${rule.id}.`,
          proposedFix: "Review the matching code path against repository policy.",
          source: { ruleId: rule.id, layer }
        })
      );
    }
  }

  return dedupeFindings(findings);
}

export function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) {
      return false;
    }
    seen.add(finding.id);
    return true;
  });
}

