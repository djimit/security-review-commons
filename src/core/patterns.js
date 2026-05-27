import { makeFinding } from "./findings.js";
import { BUILTIN_RULES } from "./rules.js";
import { lineColumnFromIndex } from "./location.js";

export function evaluatePatterns({ diff, changedFiles, layer, config }) {
  const findings = [];

  for (const rule of BUILTIN_RULES) {
    const pathMatch =
      !rule.pathRegex ||
      changedFiles.some((changedFile) => rule.pathRegex.test(changedFile));
    const ruleOutcome = evaluateRuleMatch(rule, diff, changedFiles);
    if (pathMatch && ruleOutcome.matched) {
      findings.push(
        makeFinding({
          title: rule.title,
          severity: rule.severity,
          category: rule.category,
          files: changedFiles,
          explanation: rule.explanation,
          proposedFix: rule.proposedFix,
          location: ruleOutcome.location
            ? { file: changedFiles[0], ...ruleOutcome.location }
            : null,
          source: { ruleId: rule.id, layer }
        })
      );
    }
  }

  for (const rule of config.customPatterns) {
    const pathMatch =
      !rule.compiledPathRegex ||
      changedFiles.some((path) => rule.compiledPathRegex.test(path));
    const match = execRegex(rule.compiledRegex, diff);
    if (pathMatch && match) {
      findings.push(
        makeFinding({
          title: rule.title,
          severity: rule.severity,
          category: "custom-policy",
          files: changedFiles,
          explanation: `Custom additive policy matched pattern ${rule.id}.`,
          proposedFix: "Review the matching code path against repository policy.",
          location: {
            file: changedFiles[0],
            ...lineColumnFromIndex(diff, match.index)
          },
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

function evaluateRuleMatch(rule, diff, changedFiles) {
  if (rule.test) {
    const outcome = rule.test(diff, changedFiles);
    if (typeof outcome === "boolean") {
      return {
        matched: outcome,
        location: outcome ? { line: 1, column: 1 } : null
      };
    }
    return {
      matched: Boolean(outcome?.matched),
      location: outcome?.location ?? null
    };
  }

  const match = execRegex(rule.regex, diff);
  if (!match) {
    return { matched: false, location: null };
  }

  return {
    matched: true,
    location: lineColumnFromIndex(diff, match.index)
  };
}

function execRegex(regex, text) {
  const flags = regex.flags.replaceAll("g", "");
  return new RegExp(regex.source, flags).exec(text);
}
