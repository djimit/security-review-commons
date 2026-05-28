import fs from "node:fs";
import path from "node:path";


import { validateJsonSchema } from "./schema-validator.js";

const configSchema = JSON.parse(
  fs.readFileSync(
    new URL("../../schemas/security-review.config.schema.json", import.meta.url),
    "utf8"
  )
);

function createValidationError({ code, message, details = [] }) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  error.details = details;
  return error;
}

function assertSchemaValid({ validator, value, code, message }) {
  const result = validateJsonSchema(validator, value);
  if (result.valid) return;
  throw createValidationError({ code, message, details: result.errors });
}
const DEFAULT_CONFIG = {
  enabledLayers: ["edit", "turn", "commit", "push"],
  debug: false,
  caps: {
    maxDiffBytes: 64 * 1024,
    maxChangedFiles: 25,
    maxCustomPatterns: 50,
    maxSuppressions: 100
  },
  turnReview: {
    enabled: false,
    provider: null,
    model: null,
    minSeverityToBlock: "high",
    maxModelDiffBytes: 16 * 1024,
    maxPromptChars: 12 * 1024,
    maxModelFindings: 5,
    timeoutMs: 30_000,
    command: null
  },
  checkpointReview: {
    enabledAdjacentContext: true,
    maxContextFiles: 8,
    maxContextBytes: 64 * 1024,
    maxAdjacentSearchDepth: 2
  },
  repoGuidance: [],
  customPatterns: [],
  suppressions: []
};
const ALLOWED_LAYERS = new Set(["edit", "turn", "commit", "push"]);

function assertStringArray(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
}

function compileSafeRegex(source, field) {
  if (typeof source !== "string" || source.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (source.length > 300) {
    throw new Error(`${field} is too long`);
  }
  return new RegExp(source, "i");
}

function assertOptionalString(value, field) {
  if (value !== null && value !== undefined && typeof value !== "string") {
    throw new Error(`${field} must be a string when provided`);
  }
}

function assertInteger(value, field, minimum) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${field} must be an integer >= ${minimum}`);
  }
}

function validateTurnReview(turnReview) {
  if (typeof turnReview !== "object" || turnReview === null) {
    throw new Error("turnReview must be an object");
  }

  if (typeof turnReview.enabled !== "boolean") {
    throw new Error("turnReview.enabled must be a boolean");
  }
  assertOptionalString(turnReview.provider, "turnReview.provider");
  assertOptionalString(turnReview.model, "turnReview.model");
  if (!["low", "medium", "high", "critical"].includes(turnReview.minSeverityToBlock)) {
    throw new Error("turnReview.minSeverityToBlock has an unknown severity");
  }
  assertInteger(turnReview.maxModelDiffBytes, "turnReview.maxModelDiffBytes", 1024);
  assertInteger(turnReview.maxPromptChars, "turnReview.maxPromptChars", 1024);
  assertInteger(turnReview.maxModelFindings, "turnReview.maxModelFindings", 1);
  assertInteger(turnReview.timeoutMs, "turnReview.timeoutMs", 1000);

  if (turnReview.command === null) {
    return;
  }

  if (typeof turnReview.command !== "object") {
    throw new Error("turnReview.command must be an object or null");
  }
  if (typeof turnReview.command.executable !== "string" || turnReview.command.executable.length === 0) {
    throw new Error("turnReview.command.executable must be a non-empty string");
  }
  if (
    turnReview.command.args !== undefined &&
    (!Array.isArray(turnReview.command.args) ||
      turnReview.command.args.some((entry) => typeof entry !== "string"))
  ) {
    throw new Error("turnReview.command.args must be an array of strings");
  }
}

function validateCheckpointReview(checkpointReview) {
  if (typeof checkpointReview !== "object" || checkpointReview === null) {
    throw new Error("checkpointReview must be an object");
  }
  if (typeof checkpointReview.enabledAdjacentContext !== "boolean") {
    throw new Error("checkpointReview.enabledAdjacentContext must be a boolean");
  }
  assertInteger(
    checkpointReview.maxContextFiles,
    "checkpointReview.maxContextFiles",
    0
  );
  assertInteger(
    checkpointReview.maxContextBytes,
    "checkpointReview.maxContextBytes",
    1024
  );
  assertInteger(
    checkpointReview.maxAdjacentSearchDepth,
    "checkpointReview.maxAdjacentSearchDepth",
    0
  );
}

export function loadConfig(raw = {}) {
  assertSchemaValid({
    validator: configSchema,
    value: raw,
    code: "SRC_CFG_SCHEMA_INVALID",
    message: "Config validation failed"
  });
  const merged = {
    ...DEFAULT_CONFIG,
    ...raw,
    caps: {
      ...DEFAULT_CONFIG.caps,
      ...(raw.caps ?? {})
    },
    turnReview: {
      ...DEFAULT_CONFIG.turnReview,
      ...(raw.turnReview ?? {}),
      command:
        raw.turnReview?.command === undefined
          ? DEFAULT_CONFIG.turnReview.command
          : raw.turnReview.command
    },
    checkpointReview: {
      ...DEFAULT_CONFIG.checkpointReview,
      ...(raw.checkpointReview ?? {})
    },
    repoGuidance: [...DEFAULT_CONFIG.repoGuidance, ...(raw.repoGuidance ?? [])],
    customPatterns: [...DEFAULT_CONFIG.customPatterns, ...(raw.customPatterns ?? [])],
    suppressions: [...DEFAULT_CONFIG.suppressions, ...(raw.suppressions ?? [])]
  };

  assertStringArray(merged.enabledLayers, "enabledLayers");
  if (merged.enabledLayers.some((layer) => !ALLOWED_LAYERS.has(layer))) {
    throw new Error("enabledLayers contains an unknown layer");
  }
  if (typeof merged.debug !== "boolean") {
    throw new Error("debug must be a boolean");
  }
  assertStringArray(merged.repoGuidance, "repoGuidance");
  validateTurnReview(merged.turnReview);
  validateCheckpointReview(merged.checkpointReview);

  if (merged.customPatterns.length > merged.caps.maxCustomPatterns) {
    throw new Error("customPatterns exceeds maxCustomPatterns");
  }
  if (merged.suppressions.length > merged.caps.maxSuppressions) {
    throw new Error("suppressions exceeds maxSuppressions");
  }

  const compiledPatterns = merged.customPatterns.map((pattern) => {
    if (typeof pattern.id !== "string" || typeof pattern.title !== "string") {
      throw new Error("customPatterns entries need id and title");
    }
    return {
      ...pattern,
      compiledRegex: compileSafeRegex(pattern.regex, `${pattern.id}.regex`),
      compiledPathRegex: pattern.pathRegex
        ? compileSafeRegex(pattern.pathRegex, `${pattern.id}.pathRegex`)
        : null
    };
  });

  return {
    ...merged,
    customPatterns: compiledPatterns
  };
}

export function loadResolvedConfig({
  rawConfig = {},
  repoRoot = null,
  env = process.env
} = {}) {
  const guidanceConfig = loadGuidanceFiles({ repoRoot, env });
  const runtimeConfig = loadRuntimeConfigFromEnv(env);
  return loadConfig(
    mergeAdditiveConfig(
      mergeAdditiveConfig(guidanceConfig.config, runtimeConfig),
      rawConfig
    )
  );
}

export function loadGuidanceFiles({ repoRoot = null, env = process.env } = {}) {
  const sources = [];
  const guidancePaths = buildGuidancePaths({ repoRoot, env });

  for (const guidancePath of guidancePaths) {
    if (!guidancePath.path) {
      continue;
    }
    const parsed = readGuidanceFile(guidancePath.path);
    if (!parsed) {
      continue;
    }

    sources.push({
      scope: guidancePath.scope,
      path: guidancePath.path,
      config: parsed
    });
  }

  const config = sources.reduce(
    (merged, source) => mergeAdditiveConfig(merged, source.config),
    {
      repoGuidance: [],
      customPatterns: [],
      suppressions: []
    }
  );

  return {
    config,
    sources
  };
}

export function mergeAdditiveConfig(baseConfig = {}, extraConfig = {}) {
  return {
    ...baseConfig,
    ...extraConfig,
    caps: {
      ...(baseConfig.caps ?? {}),
      ...(extraConfig.caps ?? {})
    },
    turnReview: {
      ...(baseConfig.turnReview ?? {}),
      ...(extraConfig.turnReview ?? {}),
      command:
        extraConfig.turnReview?.command === undefined
          ? baseConfig.turnReview?.command
          : extraConfig.turnReview.command
    },
    checkpointReview: {
      ...(baseConfig.checkpointReview ?? {}),
      ...(extraConfig.checkpointReview ?? {})
    },
    repoGuidance: [
      ...(baseConfig.repoGuidance ?? []),
      ...(extraConfig.repoGuidance ?? [])
    ],
    customPatterns: [
      ...(baseConfig.customPatterns ?? []),
      ...(extraConfig.customPatterns ?? [])
    ],
    suppressions: [
      ...(baseConfig.suppressions ?? []),
      ...(extraConfig.suppressions ?? [])
    ]
  };
}

function buildGuidancePaths({ repoRoot, env }) {
  const resolvedRepoRoot =
    typeof repoRoot === "string" && repoRoot.length > 0
      ? path.resolve(repoRoot)
      : null;

  return [
    {
      scope: "user",
      path:
        typeof env.SECURITY_REVIEW_USER_GUIDANCE_FILE === "string"
          ? path.resolve(env.SECURITY_REVIEW_USER_GUIDANCE_FILE)
          : null
    },
    {
      scope: "project",
      path: resolvedRepoRoot
        ? path.join(resolvedRepoRoot, ".security-review", "guidance.json")
        : null
    },
    {
      scope: "local",
      path: resolvedRepoRoot
        ? path.join(resolvedRepoRoot, ".security-review", "guidance.local.json")
        : null
    }
  ];
}

function readGuidanceFile(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("guidance file must contain a JSON object");
    }

    const guidance = {
      repoGuidance: Array.isArray(parsed.repoGuidance) ? parsed.repoGuidance : [],
      customPatterns: Array.isArray(parsed.customPatterns) ? parsed.customPatterns : [],
      suppressions: Array.isArray(parsed.suppressions) ? parsed.suppressions : []
    };

    assertStringArray(guidance.repoGuidance, "repoGuidance");
    return guidance;
  } catch {
    return null;
  }
}

export function loadRuntimeConfigFromEnv(env = process.env) {
  const runtimeConfig = {};
  const enabledLayers = parseLayerList(env.SECURITY_REVIEW_ENABLED_LAYERS);
  const debug = parseBooleanEnv(env.SECURITY_REVIEW_DEBUG);
  const maxDiffBytes = parseIntegerEnv(env.SECURITY_REVIEW_MAX_DIFF_BYTES);
  const maxChangedFiles = parseIntegerEnv(env.SECURITY_REVIEW_MAX_CHANGED_FILES);
  const checkpointEnabledAdjacentContext = parseBooleanEnv(
    env.SECURITY_REVIEW_CHECKPOINT_ADJACENT_CONTEXT
  );
  const checkpointMaxContextFiles = parseIntegerEnv(
    env.SECURITY_REVIEW_CHECKPOINT_MAX_CONTEXT_FILES
  );
  const checkpointMaxContextBytes = parseIntegerEnv(
    env.SECURITY_REVIEW_CHECKPOINT_MAX_CONTEXT_BYTES
  );
  const checkpointMaxAdjacentSearchDepth = parseIntegerEnv(
    env.SECURITY_REVIEW_CHECKPOINT_MAX_ADJACENT_DEPTH
  );

  if (enabledLayers) {
    runtimeConfig.enabledLayers = enabledLayers;
  }
  if (debug !== null) {
    runtimeConfig.debug = debug;
  }
  if (maxDiffBytes !== null || maxChangedFiles !== null) {
    runtimeConfig.caps = {};
    if (maxDiffBytes !== null) {
      runtimeConfig.caps.maxDiffBytes = maxDiffBytes;
    }
    if (maxChangedFiles !== null) {
      runtimeConfig.caps.maxChangedFiles = maxChangedFiles;
    }
  }
  if (
    checkpointEnabledAdjacentContext !== null ||
    checkpointMaxContextFiles !== null ||
    checkpointMaxContextBytes !== null ||
    checkpointMaxAdjacentSearchDepth !== null
  ) {
    runtimeConfig.checkpointReview = {};
    if (checkpointEnabledAdjacentContext !== null) {
      runtimeConfig.checkpointReview.enabledAdjacentContext =
        checkpointEnabledAdjacentContext;
    }
    if (checkpointMaxContextFiles !== null) {
      runtimeConfig.checkpointReview.maxContextFiles = checkpointMaxContextFiles;
    }
    if (checkpointMaxContextBytes !== null) {
      runtimeConfig.checkpointReview.maxContextBytes = checkpointMaxContextBytes;
    }
    if (checkpointMaxAdjacentSearchDepth !== null) {
      runtimeConfig.checkpointReview.maxAdjacentSearchDepth =
        checkpointMaxAdjacentSearchDepth;
    }
  }

  return runtimeConfig;
}

function parseBooleanEnv(value) {
  if (value === undefined) {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

function parseIntegerEnv(value) {
  if (value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseLayerList(value) {
  if (typeof value !== "string") {
    return null;
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export { DEFAULT_CONFIG };
