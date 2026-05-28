import { execFileSync } from "node:child_process";

export function createCommandTurnReviewer({ turnReview, env = process.env }) {
  if (!turnReview?.enabled || !turnReview.command?.executable) {
    return null;
  }

  return async ({ context }) => {
    const stdout = execFileSync(
      turnReview.command.executable,
      turnReview.command.args ?? [],
      {
        encoding: "utf8",
        timeout: turnReview.timeoutMs,
        env,
        input: JSON.stringify({
          prompt: context.prompt,
          context
        })
      }
    );

    return JSON.parse(stdout);
  };
}

export function loadTurnReviewConfigFromEnv(env = process.env) {
  const enabled = env.SECURITY_REVIEW_TURN_REVIEW_ENABLED === "true";
  const command = env.SECURITY_REVIEW_TURN_REVIEW_COMMAND
    ? {
        executable: env.SECURITY_REVIEW_TURN_REVIEW_COMMAND,
        args: parseArgsValue(env.SECURITY_REVIEW_TURN_REVIEW_ARGS)
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
