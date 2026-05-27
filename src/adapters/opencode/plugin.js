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

export function onGitCheckpoint(event, config = {}) {
  const layer = event?.action === "push" ? "push" : "commit";
  return runDeterministicReview({
    diff: extractDiff(event),
    changedFiles: extractChangedFiles(event),
    layer,
    config
  });
}
