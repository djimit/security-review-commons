import {
  runDeterministicReview,
  runCheckpointReview
} from "../../core/review.js";

function extractDiff(event) {
  return typeof event?.diff === "string" ? event.diff : "";
}

function extractChangedFiles(event) {
  return Array.isArray(event?.changedFiles)
    ? event.changedFiles.filter((entry) => typeof entry === "string")
    : [];
}

function extractRepoRoot(event) {
  const repoRoot =
    event?.repoRoot ?? event?.workspace?.root ?? event?.cwd ?? event?.workspaceRoot;
  return typeof repoRoot === "string" ? repoRoot : undefined;
}

export function normalizeFileEditedEvent(event) {
  return {
    diff: extractDiff(event),
    changedFiles: extractChangedFiles(event)
  };
}

export function normalizeSessionDiffEvent(event) {
  return {
    diff: extractDiff(event),
    changedFiles: extractChangedFiles(event)
  };
}

export function normalizeSessionIdleEvent(event) {
  return {
    diff: extractDiff(event),
    changedFiles: extractChangedFiles(event)
  };
}

export function normalizeToolExecuteBeforeEvent(event) {
  const command =
    event?.args?.command ??
    event?.command ??
    event?.args?.cmd ??
    "";
  const isGitCommit = /\bgit\s+commit\b/i.test(command);
  const isGitPush = /\bgit\s+push\b/i.test(command);

  return {
    tool: event?.tool ?? "",
    command,
    action: isGitPush ? "push" : isGitCommit ? "commit" : null,
    diff: extractDiff(event),
    changedFiles: extractChangedFiles(event),
    repoRoot: extractRepoRoot(event)
  };
}

export function onFileEdited(event, config = {}) {
  const normalized = normalizeFileEditedEvent(event);
  return runDeterministicReview({
    ...normalized,
    layer: "edit",
    config
  });
}

export function onSessionIdle(event, config = {}) {
  const normalized = normalizeSessionIdleEvent(event);
  return runDeterministicReview({
    ...normalized,
    layer: "turn",
    config
  });
}

export function onSessionDiff(event, config = {}) {
  const normalized = normalizeSessionDiffEvent(event);
  return runDeterministicReview({
    ...normalized,
    layer: "turn",
    config
  });
}

export function onGitCheckpoint(event, config = {}) {
  return runCheckpointReview({
    repoRoot: extractRepoRoot(event),
    changedFiles: extractChangedFiles(event),
    layer: event?.action === "push" ? "push" : "commit",
    config
  });
}

export function onToolExecuteBefore(event, config = {}) {
  const normalized = normalizeToolExecuteBeforeEvent(event);
  if (normalized.tool !== "bash" || !normalized.action) {
    return null;
  }

  return runCheckpointReview({
    repoRoot: normalized.repoRoot,
    changedFiles: normalized.changedFiles,
    layer: normalized.action,
    config
  });
}
