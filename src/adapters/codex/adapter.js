import { runDeterministicReview } from "../../core/review.js";

export function reviewWorkspaceChange(input, config = {}) {
  return runDeterministicReview({
    diff: input?.diff ?? "",
    changedFiles: Array.isArray(input?.changedFiles) ? input.changedFiles : [],
    layer: input?.layer ?? "turn",
    config
  });
}

export function describeCodexLimitations() {
  return {
    supportsNativeBackgroundHooks: false,
    supportsExplicitReviewEntrypoint: true,
    note: "Use explicit commands, plugin entrypoints, or host-specific wrappers until native background hook parity is verified."
  };
}
