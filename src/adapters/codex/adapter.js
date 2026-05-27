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
    supportsNativeGitInterception: false,
    note: "Use explicit commands, plugin entrypoints, or host-specific wrappers until native background hook and git interception parity is verified."
  };
}

export function recommendedCodexEntrypoints() {
  return [
    "reviewWorkspaceChange() for explicit turn or diff review",
    "a thin Codex plugin wrapper when the host exposes deterministic file hooks",
    "CI invocation through the CLI for pull request and pre-push checks"
  ];
}
