import { makeFinding } from "./findings.js";
import { BUILTIN_RULES } from "./rules.js";

export function evaluatePatterns({ diff, changedFiles, layer, config }) {
  const findings = [];

  for (const rule of BUILTIN_RULES) {
    const pathMatch =
      !rule.pathRegex ||
      changedFiles.some((changedFile) => rule.pathRegex.test(changedFile));
    const ruleMatched = rule.test ? rule.test(diff, changedFiles) : rule.regex.test(diff);
    if (pathMatch && ruleMatched) {
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

export { BUILTIN_RULES };
