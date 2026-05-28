import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  runDeterministicReview,
  runCheckpointReview
} from "../core/review.js";
import { findingsMeetSeverityThreshold } from "../core/severity.js";

export function handleClaudeHook({ mode, input, env = process.env }) {
  if (mode === "post-edit") {
    return handlePostEditHook({ input, env });
  }
  if (mode === "pre-bash") {
    return handlePreBashHook({ input, env });
  }

  throw new Error(`Unknown Claude hook mode: ${mode}`);
}

export function handlePostEditHook({ input, env = process.env }) {
  const filePath = extractEditedFilePath(input);
  if (!filePath) {
    return { continue: true };
  }

  const repoRoot = resolveProjectRoot({ filePath, env, cwd: input?.cwd });
  const relativePath = normalizeChangedFile({ repoRoot, filePath });
  const reviewText = readHookReviewText(input, filePath);
  if (!reviewText) {
    return { continue: true };
  }

  const result = runDeterministicReview({
    diff: reviewText,
    changedFiles: [relativePath],
    layer: "edit"
  });

  if (result.findings.length === 0) {
    return { continue: true };
  }

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: formatFindingsContext({
        heading: `security-review-commons found ${result.findings.length} edit-time finding(s) in ${relativePath}`,
        findings: result.findings
      })
    }
  };
}

export function handlePreBashHook({ input, env = process.env }) {
  if (input?.tool_name !== "Bash") {
    return { continue: true };
  }

  const command = input?.tool_input?.command ?? "";
  const action = classifyGitCheckpoint(command);
  if (!action) {
    return { continue: true };
  }

  const repoRoot = resolveGitRepoRoot({
    env,
    cwd: input?.cwd
  });
  if (!repoRoot) {
    return {
      continue: true,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext:
          "security-review-commons could not resolve the git repository root for checkpoint review."
      }
    };
  }

  const changedFiles = collectCheckpointFiles({ repoRoot, action });
  if (changedFiles.length === 0) {
    return { continue: true };
  }

  const result = runCheckpointReview({
    repoRoot,
    changedFiles,
    layer: action
  });
  if (result.findings.length === 0) {
    return { continue: true };
  }

  const summary = formatFindingsContext({
    heading: `security-review-commons found ${result.findings.length} checkpoint finding(s) before git ${action}`,
    findings: result.findings
  });

  if (findingsMeetSeverityThreshold(result.findings, "high")) {
    return {
      continue: true,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: summary
      }
    };
  }

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: summary
    }
  };
}

export function classifyGitCheckpoint(command) {
  if (/\bgit\s+push\b/i.test(command)) {
    return "push";
  }
  if (/\bgit\s+commit\b/i.test(command)) {
    return "commit";
  }
  return null;
}

function extractEditedFilePath(input) {
  const filePath = input?.tool_input?.file_path;
  return typeof filePath === "string" && filePath.length > 0 ? filePath : null;
}

function resolveProjectRoot({ filePath, env, cwd }) {
  const candidates = [
    env.CLAUDE_PROJECT_DIR,
    cwd,
    path.dirname(filePath)
  ].filter((value) => typeof value === "string" && value.length > 0);

  for (const candidate of candidates) {
    const absoluteCandidate = path.resolve(candidate);
    if (filePath.startsWith(absoluteCandidate)) {
      return absoluteCandidate;
    }
  }

  return path.dirname(filePath);
}

function normalizeChangedFile({ repoRoot, filePath }) {
  const relativePath = path.relative(repoRoot, filePath);
  return relativePath.startsWith("..") ? filePath : relativePath;
}

function readHookReviewText(input, filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8");
  }

  const writeContent = input?.tool_input?.content;
  if (typeof writeContent === "string") {
    return writeContent;
  }

  const newString = input?.tool_input?.new_string;
  return typeof newString === "string" ? newString : "";
}

function resolveGitRepoRoot({ env, cwd }) {
  const candidates = [env.CLAUDE_PROJECT_DIR, cwd, process.cwd()].filter(
    (value) => typeof value === "string" && value.length > 0
  );

  for (const candidate of candidates) {
    try {
      return execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd: candidate,
        encoding: "utf8"
      }).trim();
    } catch {
      continue;
    }
  }

  return null;
}

function collectCheckpointFiles({ repoRoot, action }) {
  if (action === "commit") {
    return runGitFileList(repoRoot, [
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACMRTUXB"
    ]);
  }

  const upstream = resolveUpstreamRef(repoRoot);
  if (upstream) {
    return runGitFileList(repoRoot, [
      "diff",
      "--name-only",
      "--diff-filter=ACMRTUXB",
      `${upstream}..HEAD`
    ]);
  }

  return [];
}

function resolveUpstreamRef(repoRoot) {
  try {
    return execFileSync(
      "git",
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
      {
        cwd: repoRoot,
        encoding: "utf8"
      }
    ).trim();
  } catch {
    return null;
  }
}

function runGitFileList(repoRoot, args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8"
    })
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function formatFindingsContext({ heading, findings }) {
  const lines = [heading];
  for (const finding of findings.slice(0, 5)) {
    const location = finding.location?.file ? ` in ${finding.location.file}` : "";
    lines.push(
      `- [${finding.severity}] ${finding.title}${location} (${finding.source.ruleId})`
    );
  }
  if (findings.length > 5) {
    lines.push(`- ${findings.length - 5} more finding(s) omitted`);
  }
  return lines.join("\n");
}
