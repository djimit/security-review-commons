#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { runDeterministicReview } from "./core/review.js";
import { findingsToSarif } from "./core/sarif.js";
import { runCorpus, corpusFailed, corpusToMarkdown } from "./core/corpus.js";
import { findingsMeetSeverityThreshold } from "./core/severity.js";
import { summarizeFindings, summaryToMarkdown } from "./core/summary.js";

function parseArgs(argv) {
  const args = {
    format: "json",
    layer: "turn",
    changedFiles: []
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
    } else if (token === "--corpus") {
      args.corpusFile = next;
      index += 1;
    } else if (token === "--fail-on-severity") {
      args.failOnSeverity = next;
      index += 1;
    } else if (token === "--strict-corpus") {
      args.strictCorpus = true;
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = args.configFile ? readJsonFile(args.configFile) : {};

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
    if (args.strictCorpus && corpusFailed(report)) {
      process.exitCode = 1;
    }
    return;
  }

  const diff = readDiff(args);
  const result = runDeterministicReview({
    diff,
    changedFiles: args.changedFiles,
    layer: args.layer,
    config
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

main();
