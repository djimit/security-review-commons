import crypto from "node:crypto";

export function makeFinding(input) {
  const idSource = [
    input.title,
    input.category,
    input.files.join(","),
    input.source.ruleId,
    input.source.layer
  ].join("|");

  return {
    id: crypto.createHash("sha256").update(idSource).digest("hex").slice(0, 16),
    title: input.title,
    severity: input.severity,
    confidence: input.confidence ?? "medium",
    category: input.category,
    files: input.files,
    explanation: input.explanation,
    exploitScenario: input.exploitScenario ?? "",
    proposedFix: input.proposedFix ?? "",
    verificationStatus: input.verificationStatus ?? "unverified",
    location: input.location ?? null,
    source: input.source,
    detectionMethod: input.detectionMethod ?? "pattern",
    falsePositiveRisk: input.falsePositiveRisk ?? "medium",
    remediationEffort: input.remediationEffort ?? "medium",
    complianceMapping: input.complianceMapping ?? [],
    evidence: input.evidence ?? null
  };
}
