import fs from "node:fs";
import path from "node:path";
import { Parser } from "acorn";
import { tsPlugin } from "acorn-typescript";
import { loadConfig } from "./config.js";
import { evaluatePatterns } from "./patterns.js";
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
    changedFiles: cappedFiles
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
      contextFileCount: reviewInputs.filter((input) => input.kind === "context")
        .length,
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

function collectCheckpointInputs({ repoRoot, changedFiles }) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const reviewInputs = [];
  const seenFiles = new Set();
  const jsChangedFiles = [];

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

      reviewInputs.push({
        file: relativePath,
        content,
        kind: "context"
      });
      seenFiles.add(relativePath);
    }
  }

  return reviewInputs;
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
