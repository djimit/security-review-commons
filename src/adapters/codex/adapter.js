import {
  runDeterministicReview,
  runCheckpointReview
} from "../../core/review.js";

function extractDiff(input) {
  return typeof input?.diff === "string" ? input.diff : "";
}

function extractChangedFiles(input) {
  return Array.isArray(input?.changedFiles)
    ? input.changedFiles.filter((entry) => typeof entry === "string")
    : [];
}

function extractRepoRoot(input) {
  return typeof input?.repoRoot === "string" ? input.repoRoot : undefined;
}

export function reviewCodexEdit(input, config = {}) {
  return runDeterministicReview({
    diff: extractDiff(input),
    changedFiles: extractChangedFiles(input),
    layer: "edit",
    config
  });
}

export function reviewCodexTurn(input, config = {}) {
  return runDeterministicReview({
    diff: extractDiff(input),
    changedFiles: extractChangedFiles(input),
    layer: "turn",
    config
  });
}

export function reviewCodexCheckpoint(input, config = {}) {
  return runCheckpointReview({
    repoRoot: extractRepoRoot(input),
    changedFiles: extractChangedFiles(input),
    layer: input?.layer === "push" ? "push" : "commit",
    config
  });
}

export function reviewWorkspaceChange(input, config = {}) {
  const layer = input?.layer ?? "turn";
  if (layer === "edit") {
    return reviewCodexEdit(input, config);
  }
  if (layer === "commit" || layer === "push") {
    return reviewCodexCheckpoint(input, config);
  }
  return reviewCodexTurn(input, config);
}

export function describeCodexLimitations() {
  return {
    supportsNativeBackgroundHooks: false,
    supportsExplicitReviewEntrypoint: true,
    supportsNativeGitInterception: false,
    supportsExplicitCheckpointReview: true,
    note: "Use explicit edit, turn, and checkpoint entrypoints or host-specific wrappers until native background hook and git interception parity is verified."
  };
}

export function recommendedCodexEntrypoints() {
  return [
    "reviewCodexEdit() for deterministic edit review",
    "reviewCodexTurn() for explicit turn or diff review",
    "reviewCodexCheckpoint() for commit or push review with repoRoot and changed files",
    "CI invocation through the CLI for pull request and pre-push checks"
  ];
}
