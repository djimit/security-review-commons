export const SEVERITY_ORDER = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

export function findingsMeetSeverityThreshold(findings, minimumSeverity) {
  if (!minimumSeverity) {
    return false;
  }
  const threshold = SEVERITY_ORDER[minimumSeverity];
  if (threshold === undefined) {
    throw new Error(`Unknown severity threshold: ${minimumSeverity}`);
  }

  return findings.some(
    (finding) => SEVERITY_ORDER[finding.severity] >= threshold
  );
}

