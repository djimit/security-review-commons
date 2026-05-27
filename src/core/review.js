import { loadConfig } from "./config.js";
import { evaluatePatterns } from "./patterns.js";
import { toJsonlEvent } from "./jsonl.js";
import { normalizeSuppressions, applySuppressions } from "./suppressions.js";

export function capReviewInput({ diff, changedFiles, config }) {
  const cappedDiff = diff.slice(0, config.caps.maxDiffBytes);
  const cappedFiles = changedFiles.slice(0, config.caps.maxChangedFiles);
  return { cappedDiff, cappedFiles };
}

export function runDeterministicReview({
  diff,
  changedFiles,
  layer = "turn",
  config: rawConfig = {}
}) {
  const config = loadConfig(rawConfig);
  const suppressions = normalizeSuppressions(config.suppressions);
  const { cappedDiff, cappedFiles } = capReviewInput({
    diff,
    changedFiles,
    config
  });
  const findings = evaluatePatterns({
    diff: cappedDiff,
    changedFiles: cappedFiles,
    layer,
    config
  });
  const { activeFindings, suppressedFindings } = applySuppressions(
    findings,
    suppressions
  );

  return {
    findings: activeFindings,
    suppressedFindings,
    summary: {
      totalFindings: findings.length,
      activeFindings: activeFindings.length,
      suppressedFindings: suppressedFindings.length
    },
    auditEvent: toJsonlEvent({
      layer,
      changedFileCount: cappedFiles.length,
      diffBytesReviewed: cappedDiff.length,
      findingCount: activeFindings.length,
      suppressedFindingCount: suppressedFindings.length,
      repoGuidanceCount: config.repoGuidance.length
    })
  };
}

export function runLayeredReview({ diff, changedFiles, config: rawConfig = {} }) {
  const layers = ["edit", "turn", "commit", "push"];
  return Object.fromEntries(
    layers.map((layer) => [
      layer,
      runDeterministicReview({ diff, changedFiles, layer, config: rawConfig })
    ])
  );
}
