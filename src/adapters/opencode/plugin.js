import { runDeterministicReview } from "../../core/review.js";

function extractDiff(event) {
  return event?.diff ?? "";
}

function extractChangedFiles(event) {
  return Array.isArray(event?.changedFiles) ? event.changedFiles : [];
}

export function onFileEdited(event, config = {}) {
  return runDeterministicReview({
    diff: extractDiff(event),
    changedFiles: extractChangedFiles(event),
    layer: "edit",
    config
  });
}

export function onSessionIdle(event, config = {}) {
  return runDeterministicReview({
    diff: extractDiff(event),
    changedFiles: extractChangedFiles(event),
    layer: "turn",
    config
  });
}

export function onSessionDiff(event, config = {}) {
  return runDeterministicReview({
    diff: extractDiff(event),
    changedFiles: extractChangedFiles(event),
    layer: "turn",
    config
  });
}

export function onGitCheckpoint(event, config = {}) {
  const layer = event?.action === "push" ? "push" : "commit";
  return runDeterministicReview({
    diff: extractDiff(event),
    changedFiles: extractChangedFiles(event),
    layer,
    config
  });
}

export function onToolExecuteBefore(event, config = {}) {
  if (event?.tool !== "bash") {
    return null;
  }

  const command = event?.args?.command ?? "";
  const isGitCommit = /\bgit\s+commit\b/i.test(command);
  const isGitPush = /\bgit\s+push\b/i.test(command);

  if (!isGitCommit && !isGitPush) {
    return null;
  }

  return onGitCheckpoint(
    {
      action: isGitPush ? "push" : "commit",
      diff: extractDiff(event),
      changedFiles: extractChangedFiles(event)
    },
    config
  );
}
