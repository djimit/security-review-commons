import fs from "node:fs";
import path from "node:path";
import { runDeterministicReview, runCheckpointReview } from "./review.js";
import { summarizeFindings } from "./summary.js";

export function loadCorpus(manifestPath) {
  return JSON.parse(fs.readFileSync(path.resolve(manifestPath), "utf8"));
}

export function runCorpus({ manifestPath, baseDir = process.cwd(), config = {} }) {
  const manifest = loadCorpus(manifestPath);
  const executedCases = manifest.cases.map((testCase) => {
    const review =
      testCase.reviewMode === "checkpoint"
        ? runCheckpointReview({
            repoRoot: path.resolve(baseDir, testCase.repoRoot),
            changedFiles: testCase.changedFiles,
            layer: testCase.layer ?? "commit",
            config
          })
        : runDeterministicReview({
            diff: fs.readFileSync(path.resolve(baseDir, testCase.fixture), "utf8"),
            changedFiles: testCase.changedFiles,
            layer: testCase.layer ?? "turn",
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
    findingsSummary: summarizeFindings(flattenedFindings)
  };
}

export function corpusToMarkdown(report) {
  const lines = [
    "# Corpus Report",
    "",
    `Corpus: ${report.manifestName}`,
    `Cases: ${report.passedCases}/${report.totalCases} passed`,
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
