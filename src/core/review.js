import fs from "node:fs";
import path from "node:path";
import { Parser } from "acorn";
import { tsPlugin } from "acorn-typescript";
import { loadConfig } from "./config.js";
import { makeFinding } from "./findings.js";
import { evaluatePatterns, dedupeFindings } from "./patterns.js";
import { toJsonlEvent } from "./jsonl.js";
import { normalizeSuppressions, applySuppressions } from "./suppressions.js";
import { evaluateJsSemanticFindings } from "./js-semantic.js";

const JS_PATH_REGEX = /(^|\/).+\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i;
const JSImportExtensions = [
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts"
];
const ADJACENT_CONTEXT_DIR_NAMES = [
  "auth",
  "config",
  "guards",
  "middleware",
  "policies",
  "policy",
  "permissions",
  "routes",
  "router",
  "security"
];
const ADJACENT_CONTEXT_FILE_REGEX =
  /(^|\/)(auth|guard|guards|config|middleware|policy|policies|permission|permissions|route|routes|router|security)\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i;
const TypeScriptParser = Parser.extend(tsPlugin());

export function capReviewInput({ diff, changedFiles, config }) {
  const cappedDiff = diff.slice(0, config.caps.maxDiffBytes);
  const cappedFiles = changedFiles.slice(0, config.caps.maxChangedFiles);
  return { cappedDiff, cappedFiles };
}

export function runDeterministicReview({
  diff,
  changedFiles,
  layer = "turn",
  config: rawConfig = {}
}) {
  const config = loadConfig(rawConfig);
  const suppressions = normalizeSuppressions(config.suppressions);
  const { cappedDiff, cappedFiles } = capReviewInput({
    diff,
    changedFiles,
    config
  });
  const findings = [
    ...evaluatePatterns({
      diff: cappedDiff,
      changedFiles: cappedFiles,
      layer,
      config
    }),
    ...evaluateJsSemanticFindings({
      diff: cappedDiff,
      changedFiles: cappedFiles,
      layer
    })
  ];
  const { activeFindings, suppressedFindings } = applySuppressions(
    findings,
    suppressions
  );

  return {
    findings: activeFindings,
    suppressedFindings,
    summary: {
      totalFindings: findings.length,
      activeFindings: activeFindings.length,
      suppressedFindings: suppressedFindings.length
    },
    auditEvent: toJsonlEvent({
      layer,
      changedFileCount: cappedFiles.length,
      diffBytesReviewed: cappedDiff.length,
      findingCount: activeFindings.length,
      suppressedFindingCount: suppressedFindings.length,
      repoGuidanceCount: config.repoGuidance.length
    })
  };
}

export async function runTurnReview({
  diff,
  changedFiles,
  repoRoot = null,
  config: rawConfig = {},
  reviewer = null
}) {
  const config = loadConfig(rawConfig);
  const suppressions = normalizeSuppressions(config.suppressions);
  const { cappedDiff, cappedFiles } = capReviewInput({
    diff,
    changedFiles,
    config
  });
  const deterministicFindings = reviewFileContent({
    diff: cappedDiff,
    changedFiles: cappedFiles,
    layer: "turn",
    config
  });
  const reviewContext = buildTurnReviewContext({
    repoRoot,
    diff: cappedDiff,
    changedFiles: cappedFiles,
    config
  });
  const modelReview = {
    enabled: config.turnReview.enabled,
    attempted: false,
    status: config.turnReview.enabled ? "skipped" : "disabled",
    provider: config.turnReview.provider,
    model: config.turnReview.model,
    findingCount: 0
  };
  let modelFindings = [];

  if (config.turnReview.enabled) {
    if (typeof reviewer === "function") {
      modelReview.attempted = true;
      try {
        const response = await reviewer({
          context: reviewContext,
          turnReview: config.turnReview
        });
        modelFindings = normalizeModelFindings({
          response,
          changedFiles: cappedFiles,
          layer: "turn",
          provider: config.turnReview.provider,
          model: config.turnReview.model,
          maxFindings: config.turnReview.maxModelFindings
        });
        modelReview.status = "completed";
        modelReview.findingCount = modelFindings.length;
      } catch (error) {
        modelReview.status = "failed";
        modelReview.error = error instanceof Error ? error.message : String(error);
      }
    } else {
      modelReview.reason = "No turn reviewer was configured";
    }
  }

  const findings = dedupeFindings([...deterministicFindings, ...modelFindings]);
  const { activeFindings, suppressedFindings } = applySuppressions(
    findings,
    suppressions
  );

  return {
    findings: activeFindings,
    suppressedFindings,
    summary: {
      totalFindings: findings.length,
      activeFindings: activeFindings.length,
      suppressedFindings: suppressedFindings.length
    },
    modelReview,
    reviewContext,
    auditEvent: toJsonlEvent({
      layer: "turn",
      reviewMode: "turn",
      changedFileCount: cappedFiles.length,
      diffBytesReviewed: cappedDiff.length,
      findingCount: activeFindings.length,
      suppressedFindingCount: suppressedFindings.length,
      modelReviewEnabled: modelReview.enabled,
      modelReviewAttempted: modelReview.attempted,
      modelReviewStatus: modelReview.status,
      modelFindingCount: modelReview.findingCount,
      repoGuidanceCount: config.repoGuidance.length
    })
  };
}

export function runCheckpointReview({
  repoRoot,
  changedFiles,
  layer = "commit",
  config: rawConfig = {}
}) {
  if (typeof repoRoot !== "string" || repoRoot.trim().length === 0) {
    throw new Error("repoRoot is required for checkpoint review");
  }

  const config = loadConfig(rawConfig);
  const suppressions = normalizeSuppressions(config.suppressions);
  const cappedFiles = changedFiles.slice(0, config.caps.maxChangedFiles);
  const reviewInputs = collectCheckpointInputs({
    repoRoot,
    changedFiles: cappedFiles,
    config
  });
  const findings = reviewInputs.flatMap((input) =>
    reviewFileContent({
      diff: input.content,
      changedFiles: [input.file],
      layer,
      config
    })
  );
  const { activeFindings, suppressedFindings } = applySuppressions(
    findings,
    suppressions
  );

  return {
    findings: activeFindings,
    suppressedFindings,
    summary: {
      totalFindings: findings.length,
      activeFindings: activeFindings.length,
      suppressedFindings: suppressedFindings.length
    },
    auditEvent: toJsonlEvent({
      layer,
      reviewMode: "checkpoint",
      changedFileCount: cappedFiles.length,
      reviewedFileCount: reviewInputs.length,
      contextFileCount: reviewInputs.filter((input) => input.kind !== "changed")
        .length,
      importContextFileCount: reviewInputs.filter((input) => input.kind === "import-context").length,
      adjacentContextFileCount: reviewInputs.filter((input) => input.kind === "adjacent-context").length,
      skippedFileCount: cappedFiles.length - reviewInputs.filter((input) => input.kind === "changed").length,
      reviewedBytes: reviewInputs.reduce(
        (total, input) => total + input.content.length,
        0
      ),
      findingCount: activeFindings.length,
      suppressedFindingCount: suppressedFindings.length,
      repoGuidanceCount: config.repoGuidance.length
    })
  };
}

export function runLayeredReview({ diff, changedFiles, config: rawConfig = {} }) {
  const layers = ["edit", "turn", "commit", "push"];
  return Object.fromEntries(
    layers.map((layer) => [
      layer,
      runDeterministicReview({ diff, changedFiles, layer, config: rawConfig })
    ])
  );
}

function reviewFileContent({ diff, changedFiles, layer, config }) {
  return [
    ...evaluatePatterns({
      diff,
      changedFiles,
      layer,
      config
    }),
    ...evaluateJsSemanticFindings({
      diff,
      changedFiles,
      layer
    })
  ];
}

function buildTurnReviewContext({ repoRoot, diff, changedFiles, config }) {
  const boundedDiff = diff.slice(0, config.turnReview.maxModelDiffBytes);
  const promptSections = [
    "Review the current working diff for concrete security issues.",
    "Report only issues supported by evidence in the diff and changed file list.",
    "Prefer high-signal findings and avoid repeating deterministic findings without new evidence.",
    `Changed files: ${changedFiles.join(", ") || "none"}`,
    config.repoGuidance.length > 0
      ? `Repository guidance:\n- ${config.repoGuidance.join("\n- ")}`
      : "Repository guidance: none",
    `Diff:\n${boundedDiff}`
  ];
  const prompt = promptSections.join("\n\n").slice(0, config.turnReview.maxPromptChars);

  return {
    layer: "turn",
    repoRoot: typeof repoRoot === "string" ? path.resolve(repoRoot) : null,
    changedFiles,
    diff: boundedDiff,
    repoGuidance: config.repoGuidance,
    maxFindings: config.turnReview.maxModelFindings,
    prompt
  };
}

function normalizeModelFindings({
  response,
  changedFiles,
  layer,
  provider,
  model,
  maxFindings
}) {
  const rawFindings = Array.isArray(response?.findings) ? response.findings : [];
  return rawFindings.slice(0, maxFindings).map((finding, index) =>
    makeFinding({
      title: String(finding?.title ?? `Model review finding ${index + 1}`),
      severity: normalizeSeverity(finding?.severity),
      confidence: normalizeConfidence(finding?.confidence),
      category: String(finding?.category ?? "model-review"),
      files:
        Array.isArray(finding?.files) && finding.files.every((entry) => typeof entry === "string")
          ? finding.files
          : changedFiles,
      explanation: String(
        finding?.explanation ?? finding?.reason ?? "Model-backed turn review flagged a potential issue."
      ),
      exploitScenario:
        typeof finding?.exploitScenario === "string" ? finding.exploitScenario : "",
      proposedFix:
        typeof finding?.proposedFix === "string" ? finding.proposedFix : "",
      verificationStatus: "unverified",
      location: normalizeLocation(finding?.location, changedFiles[0]),
      source: {
        ruleId: buildModelRuleId({ provider, model }),
        layer
      }
    })
  );
}

function normalizeSeverity(value) {
  return ["low", "medium", "high", "critical"].includes(value) ? value : "medium";
}

function normalizeConfidence(value) {
  return ["low", "medium", "high"].includes(value) ? value : "medium";
}

function normalizeLocation(location, defaultFile) {
  if (!location || typeof location !== "object") {
    return defaultFile ? { file: defaultFile, line: 1, column: 1 } : null;
  }

  const file = typeof location.file === "string" ? location.file : defaultFile;
  const line = Number.isInteger(location.line) && location.line > 0 ? location.line : 1;
  const column =
    Number.isInteger(location.column) && location.column > 0 ? location.column : 1;

  return file ? { file, line, column } : null;
}

function buildModelRuleId({ provider, model }) {
  const providerPart = slugifyRulePart(provider ?? "configured");
  const modelPart = slugifyRulePart(model ?? "default");
  return `model-turn-review-${providerPart}-${modelPart}`;
}

function slugifyRulePart(value) {
  return String(value)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "") || "default";
}

function collectCheckpointInputs({ repoRoot, changedFiles, config }) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const reviewInputs = [];
  const seenFiles = new Set();
  const jsChangedFiles = [];
  let contextBytes = 0;

  for (const file of changedFiles) {
    const resolvedFile = resolveWorkspaceFile(resolvedRepoRoot, file);
    if (!resolvedFile) {
      continue;
    }

    const content = readWorkspaceFile(resolvedFile);
    if (content == null) {
      continue;
    }

    reviewInputs.push({ file, content, kind: "changed" });
    seenFiles.add(file);

    if (JS_PATH_REGEX.test(file)) {
      jsChangedFiles.push({ file, absolutePath: resolvedFile, content });
    }
  }

  for (const changedFile of jsChangedFiles) {
    const importedFiles = collectLocalImportContext({
      repoRoot: resolvedRepoRoot,
      absoluteFilePath: changedFile.absolutePath,
      sourceText: changedFile.content
    });

    for (const importedFile of importedFiles) {
      const relativePath = path.relative(resolvedRepoRoot, importedFile);
      if (seenFiles.has(relativePath)) {
        continue;
      }

      const content = readWorkspaceFile(importedFile);
      if (content == null) {
        continue;
      }

      if (
        !canAddContextInput({
          config,
          currentContextCount: reviewInputs.filter((input) => input.kind !== "changed").length,
          currentContextBytes: contextBytes,
          nextContentLength: content.length
        })
      ) {
        continue;
      }

      reviewInputs.push({
        file: relativePath,
        content,
        kind: "import-context"
      });
      seenFiles.add(relativePath);
      contextBytes += content.length;
    }
  }

  if (config.checkpointReview.enabledAdjacentContext) {
    const adjacentFiles = collectAdjacentContextFiles({
      repoRoot: resolvedRepoRoot,
      changedFiles,
      seenFiles,
      maxDepth: config.checkpointReview.maxAdjacentSearchDepth
    });

    for (const adjacentFile of adjacentFiles) {
      const content = readWorkspaceFile(adjacentFile.absolutePath);
      if (content == null) {
        continue;
      }
      if (
        !canAddContextInput({
          config,
          currentContextCount: reviewInputs.filter((input) => input.kind !== "changed").length,
          currentContextBytes: contextBytes,
          nextContentLength: content.length
        })
      ) {
        continue;
      }

      reviewInputs.push({
        file: adjacentFile.relativePath,
        content,
        kind: "adjacent-context"
      });
      seenFiles.add(adjacentFile.relativePath);
      contextBytes += content.length;
    }
  }

  return reviewInputs;
}

function canAddContextInput({
  config,
  currentContextCount,
  currentContextBytes,
  nextContentLength
}) {
  if (currentContextCount >= config.checkpointReview.maxContextFiles) {
    return false;
  }
  if (
    currentContextBytes + nextContentLength >
    config.checkpointReview.maxContextBytes
  ) {
    return false;
  }
  return true;
}

function resolveWorkspaceFile(repoRoot, filePath) {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    return null;
  }

  const resolvedPath = path.resolve(repoRoot, filePath);
  if (!isPathInsideRoot(repoRoot, resolvedPath)) {
    return null;
  }

  return resolvedPath;
}

function readWorkspaceFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return null;
    }
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function collectLocalImportContext({ repoRoot, absoluteFilePath, sourceText }) {
  const ast = tryParseJsLike(sourceText);
  if (!ast) {
    return [];
  }

  const localSpecifiers = new Set();
  visitNodes(ast, (node) => {
    if (node.type === "ImportDeclaration") {
      addLocalSpecifier(localSpecifiers, node.source?.value);
      return;
    }

    if (
      (node.type === "ExportNamedDeclaration" ||
        node.type === "ExportAllDeclaration") &&
      node.source
    ) {
      addLocalSpecifier(localSpecifiers, node.source.value);
      return;
    }

    if (
      node.type === "CallExpression" &&
      node.callee?.type === "Identifier" &&
      node.callee.name === "require" &&
      node.arguments[0]?.type === "Literal"
    ) {
      addLocalSpecifier(localSpecifiers, node.arguments[0].value);
      return;
    }

    if (
      node.type === "ImportExpression" &&
      node.source?.type === "Literal"
    ) {
      addLocalSpecifier(localSpecifiers, node.source.value);
    }
  });

  return [...localSpecifiers]
    .map((specifier) =>
      resolveLocalImportFile({ repoRoot, absoluteFilePath, specifier })
    )
    .filter(Boolean);
}

function collectAdjacentContextFiles({
  repoRoot,
  changedFiles,
  seenFiles,
  maxDepth
}) {
  const searchDirs = collectAdjacentSearchDirs({
    repoRoot,
    changedFiles
  });
  const adjacentFiles = [];
  const seenAdjacentFiles = new Set();
  const seenDirs = new Set();

  for (const searchDir of searchDirs) {
    if (seenDirs.has(searchDir)) {
      continue;
    }
    seenDirs.add(searchDir);

    for (const adjacentFile of walkAdjacentContextDir({
      repoRoot,
      absoluteDir: searchDir,
      depth: 0,
      maxDepth,
      seenFiles
    })) {
      if (seenAdjacentFiles.has(adjacentFile.relativePath)) {
        continue;
      }
      seenAdjacentFiles.add(adjacentFile.relativePath);
      adjacentFiles.push(adjacentFile);
    }
  }

  return adjacentFiles;
}

function collectAdjacentSearchDirs({ repoRoot, changedFiles }) {
  const dirs = new Set();

  for (const changedFile of changedFiles) {
    const absoluteFile = resolveWorkspaceFile(repoRoot, changedFile);
    if (!absoluteFile) {
      continue;
    }

    const fileDir = path.dirname(absoluteFile);
    const parentDir = path.dirname(fileDir);
    dirs.add(fileDir);
    dirs.add(parentDir);

    for (const baseDir of [fileDir, parentDir]) {
      for (const dirName of ADJACENT_CONTEXT_DIR_NAMES) {
        const candidate = path.join(baseDir, dirName);
        if (isPathInsideRoot(repoRoot, candidate)) {
          dirs.add(candidate);
        }
      }
    }
  }

  return [...dirs].filter((candidate) => {
    try {
      return fs.statSync(candidate).isDirectory();
    } catch {
      return false;
    }
  });
}

function walkAdjacentContextDir({
  repoRoot,
  absoluteDir,
  depth,
  maxDepth,
  seenFiles
}) {
  if (depth > maxDepth) {
    return [];
  }

  const entries = safeReadDir(absoluteDir);
  const collected = [];

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path.relative(repoRoot, absolutePath);

    if (entry.isDirectory()) {
      if (depth < maxDepth) {
        collected.push(
          ...walkAdjacentContextDir({
            repoRoot,
            absoluteDir: absolutePath,
            depth: depth + 1,
            maxDepth,
            seenFiles
          })
        );
      }
      continue;
    }

    if (
      !entry.isFile() ||
      seenFiles.has(relativePath) ||
      !ADJACENT_CONTEXT_FILE_REGEX.test(relativePath)
    ) {
      continue;
    }

    collected.push({
      relativePath,
      absolutePath
    });
  }

  return collected.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
}

function safeReadDir(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function tryParseJsLike(sourceText) {
  try {
    return TypeScriptParser.parse(sourceText, {
      ecmaVersion: "latest",
      sourceType: "module"
    });
  } catch {
    return null;
  }
}

function visitNodes(node, visitor) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (typeof node.type === "string") {
    visitor(node);
  }
  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        visitNodes(entry, visitor);
      }
      continue;
    }
    if (value && typeof value === "object") {
      visitNodes(value, visitor);
    }
  }
}

function addLocalSpecifier(target, specifier) {
  if (
    typeof specifier === "string" &&
    (specifier.startsWith("./") || specifier.startsWith("../"))
  ) {
    target.add(specifier);
  }
}

function resolveLocalImportFile({ repoRoot, absoluteFilePath, specifier }) {
  const basePath = path.resolve(path.dirname(absoluteFilePath), specifier);
  const candidates = path.extname(basePath)
    ? [basePath]
    : [
        ...JSImportExtensions.map((extension) => `${basePath}${extension}`),
        ...JSImportExtensions.map((extension) =>
          path.join(basePath, `index${extension}`)
        )
      ];

  for (const candidate of candidates) {
    if (!isPathInsideRoot(repoRoot, candidate)) {
      continue;
    }

    try {
      if (fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function isPathInsideRoot(rootPath, candidatePath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}
