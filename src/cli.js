#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  runDeterministicReview,
  runTurnReview,
  runCheckpointReview
} from "./core/review.js";
import { loadResolvedConfig } from "./core/config.js";
import { emitDebugEvent, parseAuditEvent } from "./core/debug.js";
import { createCommandTurnReviewer } from "./plugin/command-turn-reviewer.js";
import { findingsToSarif } from "./core/sarif.js";
import { runCorpus, corpusFailed, corpusToMarkdown } from "./core/corpus.js";
import { findingsMeetSeverityThreshold } from "./core/severity.js";
import { summarizeFindings, summaryToMarkdown } from "./core/summary.js";

function parseArgs(argv) {
  const args = {
    format: "json",
    layer: "turn",
    changedFiles: [],
    reviewMode: "deterministic"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--diff-file") {
      args.diffFile = next;
      index += 1;
    } else if (token === "--config") {
      args.configFile = next;
      index += 1;
    } else if (token === "--format") {
      args.format = next;
      index += 1;
    } else if (token === "--layer") {
      args.layer = next;
      index += 1;
    } else if (token === "--changed-files") {
      args.changedFiles = next
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
    } else if (token === "--changed-files-file") {
      args.changedFilesFile = next;
      index += 1;
    } else if (token === "--corpus") {
      args.corpusFile = next;
      index += 1;
    } else if (token === "--fail-on-severity") {
      args.failOnSeverity = next;
      index += 1;
    } else if (token === "--strict-corpus") {
      args.strictCorpus = true;
    } else if (token === "--repo-root") {
      args.repoRoot = next;
      index += 1;
    } else if (token === "--review-mode") {
      args.reviewMode = next;
      index += 1;
    } else if (token === "--enabled-layers") {
      args.enabledLayers = next
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
    } else if (token === "--debug") {
      args.debug = true;
    } else if (token === "--max-diff-bytes") {
      args.maxDiffBytes = Number.parseInt(next, 10);
      index += 1;
    } else if (token === "--max-changed-files") {
      args.maxChangedFiles = Number.parseInt(next, 10);
      index += 1;
    } else if (token === "--checkpoint-max-context-files") {
      args.maxContextFiles = Number.parseInt(next, 10);
      index += 1;
    } else if (token === "--checkpoint-max-context-bytes") {
      args.maxContextBytes = Number.parseInt(next, 10);
      index += 1;
    } else if (token === "--checkpoint-max-adjacent-depth") {
      args.maxAdjacentSearchDepth = Number.parseInt(next, 10);
      index += 1;
    }
  }

  return args;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function readDiff(args) {
  if (args.diffFile) {
    return fs.readFileSync(path.resolve(args.diffFile), "utf8");
  }
  return fs.readFileSync(0, "utf8");
}

function readChangedFiles(args) {
  const inlineFiles = Array.isArray(args.changedFiles) ? args.changedFiles : [];
  if (!args.changedFilesFile) {
    return [...new Set(inlineFiles)];
  }

  const fileLines = fs
    .readFileSync(path.resolve(args.changedFilesFile), "utf8")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return [...new Set([...inlineFiles, ...fileLines])];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseConfig = args.configFile ? readJsonFile(args.configFile) : {};
  const config = {
    ...baseConfig,
    ...(args.enabledLayers ? { enabledLayers: args.enabledLayers } : {}),
    ...(args.debug !== undefined ? { debug: args.debug } : {}),
    ...(
      args.maxDiffBytes !== undefined ||
      args.maxChangedFiles !== undefined
        ? {
            caps: {
              ...(baseConfig.caps ?? {}),
              ...(args.maxDiffBytes !== undefined
                ? { maxDiffBytes: args.maxDiffBytes }
                : {}),
              ...(args.maxChangedFiles !== undefined
                ? { maxChangedFiles: args.maxChangedFiles }
                : {})
            }
          }
        : {}
    ),
    ...(
      args.maxContextFiles !== undefined ||
      args.maxContextBytes !== undefined ||
      args.maxAdjacentSearchDepth !== undefined
        ? {
            checkpointReview: {
              ...(baseConfig.checkpointReview ?? {}),
              ...(args.maxContextFiles !== undefined
                ? { maxContextFiles: args.maxContextFiles }
                : {}),
              ...(args.maxContextBytes !== undefined
                ? { maxContextBytes: args.maxContextBytes }
                : {}),
              ...(args.maxAdjacentSearchDepth !== undefined
                ? { maxAdjacentSearchDepth: args.maxAdjacentSearchDepth }
                : {})
            }
          }
        : {}
    )
  };
  const changedFiles = readChangedFiles(args);
  const repoRoot = args.repoRoot ?? process.cwd();
  const resolvedConfig = loadResolvedConfig({
    rawConfig: config,
    repoRoot,
    env: process.env
  });

  if (args.corpusFile) {
    const report = runCorpus({
      manifestPath: args.corpusFile,
      baseDir: process.cwd(),
      config
    });

    if (args.format === "markdown") {
      process.stdout.write(`${corpusToMarkdown(report)}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }
    emitDebugEvent({
      enabled: resolvedConfig.debug,
      event: {
        mode: "corpus",
        manifestName: report.manifestName,
        totalCases: report.totalCases,
        failedCases: report.failedCases
      }
    });
    if (args.strictCorpus && corpusFailed(report)) {
      process.exitCode = 1;
    }
    return;
  }

  const diff = readDiff(args);
  const result =
    args.reviewMode === "checkpoint"
      ? runCheckpointReview({
          repoRoot: args.repoRoot,
          changedFiles,
          layer: args.layer,
          config
        })
      : args.reviewMode === "turn"
        ? await runTurnReview({
            diff,
            changedFiles,
            repoRoot,
            config,
            reviewer: createCommandTurnReviewer({
              turnReview: config.turnReview
            })
          })
        : runDeterministicReview({
            diff,
            changedFiles,
            layer: args.layer,
            config,
            repoRoot
          });

  emitDebugEvent({
    enabled: resolvedConfig.debug,
    event: {
      mode: args.reviewMode,
      auditEvent: parseAuditEvent(result.auditEvent)
    }
  });

  if (args.format === "sarif") {
    process.stdout.write(
      `${JSON.stringify(findingsToSarif({ findings: result.findings }), null, 2)}\n`
    );
    return;
  }

  if (args.format === "summary") {
    process.stdout.write(
      `${JSON.stringify(summarizeFindings(result.findings), null, 2)}\n`
    );
    return;
  }

  if (args.format === "markdown") {
    process.stdout.write(
      `${summaryToMarkdown(summarizeFindings(result.findings))}\n`
    );
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }

  if (findingsMeetSeverityThreshold(result.findings, args.failOnSeverity)) {
    process.exitCode = 1;
  }
}

await main();
