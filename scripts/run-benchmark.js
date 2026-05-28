#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  runCheckpointReview,
  runDeterministicReview,
  runTurnReview
} from "../src/core/review.js";
import { createCommandTurnReviewer } from "../src/plugin/command-turn-reviewer.js";

function parseArgs(argv) {
  const args = {
    manifest: "./benchmarks/manifest.json",
    baseDir: process.cwd(),
    format: "json"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--manifest") {
      args.manifest = next;
      index += 1;
    } else if (token === "--base-dir") {
      args.baseDir = next;
      index += 1;
    } else if (token === "--output") {
      args.output = next;
      index += 1;
    } else if (token === "--format") {
      args.format = next;
      index += 1;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(args.baseDir, args.manifest);
  const manifestDir = path.dirname(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const cases = [];

  for (const benchmarkCase of manifest.cases ?? []) {
    cases.push(await runBenchmarkCase({ benchmarkCase, manifestDir }));
  }

  const report = {
    manifestName: manifest.name ?? "security-review-benchmark",
    generatedAt: new Date().toISOString(),
    totalCases: cases.length,
    passedCases: cases.filter((entry) => entry.pass).length,
    failedCases: cases.filter((entry) => !entry.pass).length,
    hitCount: cases.reduce((total, entry) => total + entry.hitRuleIds.length, 0),
    missCount: cases.reduce((total, entry) => total + entry.missingRuleIds.length, 0),
    falsePositiveCount: cases.reduce(
      (total, entry) => total + entry.unexpectedRuleIds.length,
      0
    ),
    unresolvedComparativeCases: cases.filter(
      (entry) => entry.comparative?.status !== "verified"
    ).length,
    cases
  };

  const output =
    args.format === "markdown" ? reportToMarkdown(report) : JSON.stringify(report, null, 2);

  if (args.output) {
    const outputPath = path.resolve(args.baseDir, args.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${output}\n`);
  } else {
    process.stdout.write(`${output}\n`);
  }
}

async function runBenchmarkCase({ benchmarkCase, manifestDir }) {
  const reviewMode = benchmarkCase.reviewMode ?? "deterministic";
  const layer = benchmarkCase.layer ?? defaultLayerForReviewMode(reviewMode);
  const rawConfig = benchmarkCase.configFile
    ? readJson(path.resolve(manifestDir, benchmarkCase.configFile))
    : benchmarkCase.config ?? {};
  let result;

  if (reviewMode === "checkpoint") {
    result = runCheckpointReview({
      repoRoot: path.resolve(manifestDir, benchmarkCase.repoRoot),
      changedFiles: benchmarkCase.changedFiles ?? [],
      layer,
      config: rawConfig
    });
  } else {
    const diff = fs.readFileSync(path.resolve(manifestDir, benchmarkCase.fixture), "utf8");
    result =
      reviewMode === "turn"
        ? await runTurnReview({
            diff,
            changedFiles: benchmarkCase.changedFiles ?? [],
            repoRoot: benchmarkCase.repoRoot
              ? path.resolve(manifestDir, benchmarkCase.repoRoot)
              : manifestDir,
            layer,
            config: rawConfig,
            reviewer: createCommandTurnReviewer({
              turnReview: rawConfig.turnReview
            })
          })
        : runDeterministicReview({
            diff,
            changedFiles: benchmarkCase.changedFiles ?? [],
            layer,
            repoRoot: benchmarkCase.repoRoot
              ? path.resolve(manifestDir, benchmarkCase.repoRoot)
              : manifestDir,
            config: rawConfig
          });
  }

  const actualRuleIds = sortedRuleIds(result.findings);
  const expectedRuleIds = sortedStrings(benchmarkCase.expectedRuleIds ?? []);
  const missingRuleIds = expectedRuleIds.filter((ruleId) => !actualRuleIds.includes(ruleId));
  const unexpectedRuleIds = actualRuleIds.filter((ruleId) => !expectedRuleIds.includes(ruleId));

  return {
    id: benchmarkCase.id,
    description: benchmarkCase.description,
    reviewMode,
    layer,
    pass: missingRuleIds.length === 0 && unexpectedRuleIds.length === 0,
    hitRuleIds: expectedRuleIds.filter((ruleId) => actualRuleIds.includes(ruleId)),
    missingRuleIds,
    unexpectedRuleIds,
    actualRuleIds,
    expectedRuleIds,
    findingsSummary: result.summary,
    comparative: benchmarkCase.comparative ?? {
      status: "unresolved",
      notes: "No verified external comparator result is recorded for this case yet."
    }
  };
}

function defaultLayerForReviewMode(reviewMode) {
  if (reviewMode === "checkpoint") {
    return "commit";
  }
  return "turn";
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sortedRuleIds(findings) {
  return sortedStrings(findings.map((finding) => finding.source.ruleId));
}

function sortedStrings(values) {
  return [...new Set(values)].sort();
}

function reportToMarkdown(report) {
  const lines = [
    `# ${report.manifestName}`,
    "",
    `- Generated: ${report.generatedAt}`,
    `- Cases: ${report.totalCases}`,
    `- Passed: ${report.passedCases}`,
    `- Failed: ${report.failedCases}`,
    `- Hits: ${report.hitCount}`,
    `- Misses: ${report.missCount}`,
    `- False positives: ${report.falsePositiveCount}`,
    `- Comparative cases still unresolved: ${report.unresolvedComparativeCases}`,
    ""
  ];

  for (const benchmarkCase of report.cases) {
    lines.push(`## ${benchmarkCase.id}`);
    lines.push(`- Pass: ${benchmarkCase.pass}`);
    lines.push(`- Review mode: ${benchmarkCase.reviewMode}`);
    lines.push(`- Hits: ${benchmarkCase.hitRuleIds.join(", ") || "none"}`);
    lines.push(`- Misses: ${benchmarkCase.missingRuleIds.join(", ") || "none"}`);
    lines.push(
      `- False positives: ${benchmarkCase.unexpectedRuleIds.join(", ") || "none"}`
    );
    lines.push(`- Comparative status: ${benchmarkCase.comparative.status}`);
    lines.push(`- Comparative notes: ${benchmarkCase.comparative.notes}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

await main();
