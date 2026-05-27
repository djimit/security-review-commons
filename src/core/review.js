import { loadConfig } from "./config.js";
import { evaluatePatterns } from "./patterns.js";
import { toJsonlEvent } from "./jsonl.js";

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

  return {
    findings,
    auditEvent: toJsonlEvent({
      layer,
      changedFileCount: cappedFiles.length,
      diffBytesReviewed: cappedDiff.length,
      findingCount: findings.length,
      repoGuidanceCount: config.repoGuidance.length
    })
  };
}

