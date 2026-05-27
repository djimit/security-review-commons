export function summarizeFindings(findings) {
  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };
  const byCategory = {};

  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
  }

  return {
    total: findings.length,
    bySeverity,
    byCategory
  };
}

export function summaryToMarkdown(summary) {
  const severityLines = Object.entries(summary.bySeverity)
    .map(([severity, count]) => `- ${severity}: ${count}`)
    .join("\n");
  const categoryLines = Object.entries(summary.byCategory)
    .sort((left, right) => right[1] - left[1])
    .map(([category, count]) => `- ${category}: ${count}`)
    .join("\n");

  return [
    "# Security Review Summary",
    "",
    `Total findings: ${summary.total}`,
    "",
    "## By Severity",
    severityLines || "- none: 0",
    "",
    "## By Category",
    categoryLines || "- none: 0",
    ""
  ].join("\n");
}

