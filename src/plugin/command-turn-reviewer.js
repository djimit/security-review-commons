import { execFileSync } from "node:child_process";
import path from "node:path";

const MIN_TIMEOUT_MS = 1_000;
const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;

export function createCommandTurnReviewer({ turnReview, env = process.env }) {
  if (!turnReview?.enabled || !turnReview.command) {
    return null;
  }
  const resolvedCommand = resolveCommand(turnReview);
  if (!resolvedCommand) {
    return null;
  }

  return async ({ context }) => {
    const timeoutMs = Math.max(turnReview.timeoutMs ?? MIN_TIMEOUT_MS, MIN_TIMEOUT_MS);
    const maxOutputBytes = Math.max(
      turnReview.command.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
      1024
    );
    let stdout = "";
    let audit = {
      executablePath: resolvedCommand.executable,
      commandId: resolvedCommand.id ?? null,
      exitStatus: 0,
      parseFailure: false
    };
    try {
      stdout = execFileSync(resolvedCommand.executable, turnReview.command.args ?? [], {
        encoding: "utf8",
        timeout: timeoutMs,
        maxBuffer: maxOutputBytes,
        env,
        input: JSON.stringify({ prompt: context.prompt, context })
      });
    } catch (error) {
      audit = {
        ...audit,
        exitStatus: Number.isInteger(error?.status) ? error.status : null,
        parseFailure: false,
        executionError: error instanceof Error ? error.message : String(error)
      };
      throw new Error(`Turn review command execution failed: ${JSON.stringify(audit)}`);
    }
    const parsed = parseReviewerResponse(stdout, audit);
    return parsed;
  };
}

function resolveCommand(turnReview) {
  const command = turnReview.command;
  const allowlist = Array.isArray(turnReview.commandAllowlist)
    ? turnReview.commandAllowlist
    : [];
  if (typeof command.id === "string" && command.id.length > 0) {
    const match = allowlist.find((entry) => entry.id === command.id);
    return match ? { ...match } : null;
  }
  if (typeof command.executable !== "string" || command.executable.length === 0) {
    return null;
  }
  if (!path.isAbsolute(command.executable)) {
    throw new Error("Turn review command executable must be an absolute path");
  }
  const match = allowlist.find((entry) => entry.executable === command.executable);
  return match ? { ...match } : null;
}

function parseReviewerResponse(stdout, audit) {
  try {
    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed?.findings)) {
      throw new Error("response.findings must be an array");
    }
    return {
      ...parsed,
      audit: {
        ...audit,
        exitStatus: 0,
        parseFailure: false
      }
    };
  } catch (error) {
    throw new Error(
      `Turn review command parse failed: ${JSON.stringify({
        ...audit,
        parseFailure: true,
        exitStatus: 0,
        parseError: error instanceof Error ? error.message : String(error)
      })}`
    );
  }
}

export function loadTurnReviewConfigFromEnv(env = process.env) {
  const configuredExecutable = env.SECURITY_REVIEW_TURN_REVIEW_COMMAND;
  const enabled = env.SECURITY_REVIEW_TURN_REVIEW_ENABLED === "true";
  const command = configuredExecutable
    ? {
        id: "env.turn-review-command",
        args: parseArgsValue(env.SECURITY_REVIEW_TURN_REVIEW_ARGS),
        maxOutputBytes: parseInteger(
          env.SECURITY_REVIEW_TURN_REVIEW_MAX_OUTPUT_BYTES,
          DEFAULT_MAX_OUTPUT_BYTES
        )
      }
    : null;

  return {
    enabled,
    provider: env.SECURITY_REVIEW_TURN_REVIEW_PROVIDER ?? null,
    model: env.SECURITY_REVIEW_TURN_REVIEW_MODEL ?? null,
    minSeverityToBlock:
      env.SECURITY_REVIEW_TURN_REVIEW_MIN_SEVERITY ?? "high",
    maxModelDiffBytes: parseInteger(
      env.SECURITY_REVIEW_TURN_REVIEW_MAX_DIFF_BYTES,
      16 * 1024
    ),
    maxPromptChars: parseInteger(
      env.SECURITY_REVIEW_TURN_REVIEW_MAX_PROMPT_CHARS,
      12 * 1024
    ),
    maxModelFindings: parseInteger(
      env.SECURITY_REVIEW_TURN_REVIEW_MAX_FINDINGS,
      5
    ),
    timeoutMs: parseInteger(env.SECURITY_REVIEW_TURN_REVIEW_TIMEOUT_MS, 30_000),
    commandAllowlist: configuredExecutable
      ? [{ id: "env.turn-review-command", executable: configuredExecutable }]
      : [],
    command
  };
}

function parseInteger(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function parseArgsValue(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
      return parsed;
    }
  } catch {
    return value
      .split(/\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}
