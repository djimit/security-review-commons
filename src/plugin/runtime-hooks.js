import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadRuntimeConfigFromEnv } from "../core/config.js";
import { emitDebugEvent, parseAuditEvent } from "../core/debug.js";
import {
  runDeterministicReview,
  runTurnReview,
  runCheckpointReview
} from "../core/review.js";
import { findingsMeetSeverityThreshold } from "../core/severity.js";
import {
  createCommandTurnReviewer,
  loadTurnReviewConfigFromEnv
} from "./command-turn-reviewer.js";

function maybeCaptureRawPayload(mode, input) {
  const captureDir = process.env.SECURITY_REVIEW_CAPTURE_DIR;
  if (!captureDir || typeof captureDir !== "string") {
    return;
  }
  try {
    fs.mkdirSync(captureDir, { recursive: true });
    const filename = `plugin-raw-${mode}-${Date.now()}.json`;
    fs.writeFileSync(
      path.join(captureDir, filename),
      `${JSON.stringify(input, null, 2)}\n`
    );
  } catch {
    // capture is best-effort and must not break normal execution
  }
}

export async function handlePluginHook({ mode, input, env = process.env }) {
  maybeCaptureRawPayload(mode, input);
  if (mode === "post-edit") {
    return handlePostEditHook({ input, env });
  }
  if (mode === "pre-bash") {
    return handlePreBashHook({ input, env });
  }
  if (mode === "stop-turn") {
    return await handleStopTurnHook({ input, env });
  }

  throw new Error(`Unknown plugin hook mode: ${mode}`);
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
  const runtimeConfig = loadRuntimeConfigFromEnv(env);

  const result = runDeterministicReview({
    diff: reviewText,
    changedFiles: [relativePath],
    layer: "edit",
    config: runtimeConfig,
    repoRoot,
    env
  });
  emitDebugLog(env, {
    hookMode: "post-edit",
    repoRoot,
    changedFileCount: 1,
    findingCount: result.findings.length,
    auditEvent: parseAuditEvent(result.auditEvent)
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
  const runtimeConfig = loadRuntimeConfigFromEnv(env);

  const result = runCheckpointReview({
    repoRoot,
    changedFiles,
    layer: action,
    config: runtimeConfig,
    env
  });
  emitDebugLog(env, {
    hookMode: "pre-bash",
    layer: action,
    repoRoot,
    changedFileCount: changedFiles.length,
    findingCount: result.findings.length,
    auditEvent: parseAuditEvent(result.auditEvent)
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

export async function handleStopTurnHook({ input, env = process.env }) {
  const turnReviewConfig = loadTurnReviewConfigFromEnv(env);
  const runtimeConfig = loadRuntimeConfigFromEnv(env);
  runtimeConfig.turnReview = turnReviewConfig;
  if (!turnReviewConfig.enabled) {
    return { continue: true };
  }

  const repoRoot = resolveGitRepoRoot({
    env,
    cwd: input?.cwd
  });
  if (!repoRoot) {
    return { continue: true };
  }

  const diff = collectWorkingTreeDiff(repoRoot);
  const changedFiles = collectWorkingTreeChangedFiles(repoRoot);
  if (diff.length === 0 || changedFiles.length === 0) {
    return { continue: true };
  }

  const result = await runTurnReview({
    diff,
    changedFiles,
    repoRoot,
    config: runtimeConfig,
    reviewer: createCommandTurnReviewer({
      turnReview: turnReviewConfig,
      env
    }),
    env
  });
  if (!findingsMeetSeverityThreshold(
    result.findings,
    turnReviewConfig.minSeverityToBlock
  )) {
    emitDebugLog(env, {
      hookMode: "stop-turn",
      repoRoot,
      changedFileCount: changedFiles.length,
      findingCount: result.findings.length,
      decision: "allow",
      auditEvent: parseAuditEvent(result.auditEvent)
    });
    return { continue: true };
  }

  emitDebugLog(env, {
    hookMode: "stop-turn",
    repoRoot,
    changedFileCount: changedFiles.length,
    findingCount: result.findings.length,
    decision: "block",
    auditEvent: parseAuditEvent(result.auditEvent)
  });

  return {
    continue: true,
    decision: "block",
    reason: formatFindingsContext({
      heading: `security-review-commons found ${result.findings.length} turn-review finding(s) before stopping`,
      findings: result.findings
    })
  };
}

export function classifyGitCheckpoint(command) {
  if (matchesGitSubcommand(command, "push")) {
    return "push";
  }
  if (matchesGitSubcommand(command, "commit")) {
    return "commit";
  }
  return null;
}

function matchesGitSubcommand(command, subcommand) {
  if (typeof command !== "string" || command.length === 0) {
    return false;
  }

  const pattern = new RegExp(
    String.raw`\bgit(?:\s+-[A-Za-z]\s+\S+|\s+--[A-Za-z0-9-]+(?:=\S+)?|\s+--[A-Za-z0-9-]+\s+\S+)*\s+${subcommand}\b`,
    "i"
  );
  return pattern.test(command);
}

function emitDebugLog(env, payload) {
  emitDebugEvent({
    enabled: env.SECURITY_REVIEW_DEBUG === "true",
    event: payload
  });
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

function collectWorkingTreeDiff(repoRoot) {
  const diffParts = [];
  for (const args of [
    ["diff", "--no-ext-diff", "--unified=0", "HEAD"],
    ["diff", "--no-ext-diff", "--cached", "--unified=0"]
  ]) {
    try {
      const diffText = execFileSync("git", args, {
        cwd: repoRoot,
        encoding: "utf8"
      });
      if (diffText.trim().length > 0) {
        diffParts.push(diffText);
      }
    } catch {
      continue;
    }
  }
  return diffParts.join("\n");
}

function collectWorkingTreeChangedFiles(repoRoot) {
  const tracked = runGitFileList(repoRoot, [
    "diff",
    "--name-only",
    "--diff-filter=ACMRTUXB",
    "HEAD"
  ]);
  const untracked = runGitFileList(repoRoot, [
    "ls-files",
    "--others",
    "--exclude-standard"
  ]);

  return [...new Set([...tracked, ...untracked])];
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
