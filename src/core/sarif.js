const SARIF_LEVEL = {
  low: "note",
  medium: "warning",
  high: "error",
  critical: "error"
};

export function findingsToSarif({ findings, toolName = "security-review-commons" }) {
  const rules = dedupeRules(findings);
  const results = findings.map((finding) => ({
    ruleId: finding.source.ruleId,
    level: SARIF_LEVEL[finding.severity] ?? "warning",
    message: {
      text: `${finding.title}: ${finding.explanation}`
    },
    locations: finding.files.map((file) => ({
      physicalLocation: {
        artifactLocation: { uri: file }
      }
    })),
    properties: {
      category: finding.category,
      confidence: finding.confidence,
      severity: finding.severity,
      layer: finding.source.layer,
      verificationStatus: finding.verificationStatus
    }
  }));

  return {
    $schema:
      "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            informationUri: "https://github.com/djimit/security-review-commons",
            rules
          }
        },
        results
      }
    ]
  };
}

function dedupeRules(findings) {
  const seen = new Set();
  const rules = [];
  for (const finding of findings) {
    if (seen.has(finding.source.ruleId)) {
      continue;
    }
    seen.add(finding.source.ruleId);
    rules.push({
      id: finding.source.ruleId,
      name: finding.title,
      shortDescription: { text: finding.title },
      fullDescription: { text: finding.explanation },
      properties: {
        category: finding.category,
        severity: finding.severity
      }
    });
  }
  return rules;
}

