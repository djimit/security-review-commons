import fs from "node:fs";
import path from "node:path";
import { runDeterministicReview, runCheckpointReview } from "./review.js";
import { summarizeFindings } from "./summary.js";
import { getBuiltinRuleMetadata } from "./rules.js";
import { getJsSemanticRuleMetadata } from "./js-semantic.js";

export function loadCorpus(manifestPath) {
  return JSON.parse(fs.readFileSync(path.resolve(manifestPath), "utf8"));
}

export function runCorpus({ manifestPath, baseDir = process.cwd(), config = {} }) {
  const manifest = loadCorpus(manifestPath);
  const executedCases = manifest.cases.map((testCase) => {
    const reviewMode = testCase.reviewMode ?? "deterministic";
    const layer = testCase.layer ?? (reviewMode === "checkpoint" ? "commit" : "turn");
    const review =
      reviewMode === "checkpoint"
        ? runCheckpointReview({
            repoRoot: path.resolve(baseDir, testCase.repoRoot),
            changedFiles: testCase.changedFiles,
            layer,
            config
          })
        : runDeterministicReview({
            diff: fs.readFileSync(path.resolve(baseDir, testCase.fixture), "utf8"),
            changedFiles: testCase.changedFiles,
            layer,
            config
          });
    const actualRuleIds = review.findings.map((finding) => finding.source.ruleId).sort();
    const expectedRuleIds = [...testCase.expectedRuleIds].sort();
    const pass =
      actualRuleIds.length === expectedRuleIds.length &&
      actualRuleIds.every((ruleId, index) => ruleId === expectedRuleIds[index]);

    return {
      id: testCase.id,
      description: testCase.description,
      reviewMode,
      layer,
      pass,
      actualRuleIds,
      expectedRuleIds,
      summary: review.summary,
      findings: review.findings
    };
  });

  const flattenedFindings = executedCases.flatMap((testCase) => testCase.findings);
  const cases = executedCases.map(({ findings, ...testCase }) => testCase);

  return {
    manifestName: manifest.name,
    totalCases: cases.length,
    passedCases: cases.filter((testCase) => testCase.pass).length,
    failedCases: cases.filter((testCase) => !testCase.pass).length,
    cases,
    findingsSummary: summarizeFindings(flattenedFindings),
    benchmarkSummary: summarizeBenchmarkCases(cases)
  };
}

export function corpusToMarkdown(report) {
  const lines = [
    "# Corpus Report",
    "",
    `Corpus: ${report.manifestName}`,
    `Cases: ${report.passedCases}/${report.totalCases} passed`,
    "",
    "## Benchmark Summary",
    "",
    ...benchmarkSectionLines("By Review Mode", report.benchmarkSummary.byReviewMode),
    "",
    ...benchmarkSectionLines("By Layer", report.benchmarkSummary.byLayer),
    "",
    ...benchmarkSectionLines("By Language", report.benchmarkSummary.byLanguage),
    "",
    ...benchmarkSectionLines("By Framework", report.benchmarkSummary.byFramework),
    "",
    ...benchmarkSectionLines("By Precision", report.benchmarkSummary.byPrecision),
    "",
    ...benchmarkSectionLines("By Recall Risk", report.benchmarkSummary.byRecallRisk),
    "",
    ...benchmarkRuleCoverageLines(report.benchmarkSummary.byExpectedRuleId),
    ""
  ];

  for (const testCase of report.cases) {
    lines.push(
      `## ${testCase.id}`,
      "",
      `- pass: ${testCase.pass}`,
      `- expected: ${testCase.expectedRuleIds.join(", ") || "none"}`,
      `- actual: ${testCase.actualRuleIds.join(", ") || "none"}`,
      ""
    );
  }

  return lines.join("\n");
}

export function corpusFailed(report) {
  return report.failedCases > 0;
}

function summarizeBenchmarkCases(cases) {
  const byReviewMode = {};
  const byLayer = {};
  const byExpectedRuleId = {};
  const byLanguage = {};
  const byFramework = {};
  const byPrecision = {};
  const byRecallRisk = {};
  const ruleMetadata = new Map(
    [...getBuiltinRuleMetadata(), ...getJsSemanticRuleMetadata()].map((entry) => [
      entry.ruleId,
      entry
    ])
  );

  for (const testCase of cases) {
    incrementBenchmarkBucket(byReviewMode, testCase.reviewMode, testCase.pass);
    incrementBenchmarkBucket(byLayer, testCase.layer, testCase.pass);

    for (const ruleId of testCase.expectedRuleIds) {
      incrementBenchmarkBucket(byExpectedRuleId, ruleId, testCase.pass);
      const metadata = ruleMetadata.get(ruleId);
      if (!metadata) {
        continue;
      }
      incrementBenchmarkBucket(byLanguage, metadata.language, testCase.pass);
      incrementBenchmarkBucket(byFramework, metadata.framework, testCase.pass);
      incrementBenchmarkBucket(byPrecision, metadata.precision, testCase.pass);
      incrementBenchmarkBucket(byRecallRisk, metadata.recall_risk, testCase.pass);
    }
  }

  return {
    byReviewMode,
    byLayer,
    byExpectedRuleId,
    byLanguage,
    byFramework,
    byPrecision,
    byRecallRisk
  };
}

function incrementBenchmarkBucket(buckets, key, pass) {
  const bucket = buckets[key] ?? { totalCases: 0, passedCases: 0 };
  bucket.totalCases += 1;
  if (pass) {
    bucket.passedCases += 1;
  }
  buckets[key] = bucket;
}

function benchmarkSectionLines(title, buckets) {
  const lines = [`### ${title}`, ""];
  const entries = Object.entries(buckets).sort((left, right) =>
    left[0].localeCompare(right[0])
  );

  if (entries.length === 0) {
    lines.push("- none");
    return lines;
  }

  for (const [name, bucket] of entries) {
    lines.push(`- ${name}: ${bucket.passedCases}/${bucket.totalCases} passed`);
  }

  return lines;
}

function benchmarkRuleCoverageLines(buckets) {
  const lines = ["### By Expected Rule", ""];
  const entries = Object.entries(buckets).sort((left, right) =>
    left[0].localeCompare(right[0])
  );

  if (entries.length === 0) {
    lines.push("- none");
    return lines;
  }

  for (const [ruleId, bucket] of entries) {
    lines.push(`- ${ruleId}: ${bucket.passedCases}/${bucket.totalCases} passed`);
  }

  return lines;
}
