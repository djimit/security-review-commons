import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const BASELINE_FILENAME = ".security-baseline.json";
const BASELINE_VERSION = 1;

function findingIdentity(finding) {
  const file = finding.files?.[0] ?? finding.location?.file ?? finding.file ?? "";
  const line = finding.location?.line ?? finding.line ?? 0;
  return `${finding.source?.ruleId ?? finding.ruleId ?? "unknown"}::${file}::${line}`;
}

function findingTypeIdentity(finding) {
  const file = finding.files?.[0] ?? finding.location?.file ?? finding.file ?? "";
  return `${finding.source?.ruleId ?? finding.ruleId ?? "unknown"}::${file}`;
}

function computeIntegrity(payload) {
  const canonical = JSON.stringify(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

export async function writeBaseline(findings, config, repoRoot) {
  const baselineFindings = findings.map((f) => {
    const file = f.files?.[0] ?? f.location?.file ?? f.file ?? "";
    const line = f.location?.line ?? f.line ?? 0;
    return {
      id: findingIdentity(f),
      ruleId: f.source?.ruleId ?? f.ruleId ?? "unknown",
      severity: f.severity,
      category: f.category,
      file,
      line
    };
  });

  const metadata = {
    scannerVersion: config?.version ?? "0.1.0",
    ruleCount: config?.rules?.length ?? 0,
    configHash: config?._hash ?? "unknown"
  };

  const payload = {
    version: BASELINE_VERSION,
    timestamp: new Date().toISOString(),
    repoRoot,
    findings: baselineFindings,
    metadata
  };

  payload.integrity = computeIntegrity(payload);

  const baselinePath = join(repoRoot, BASELINE_FILENAME);
  await mkdir(dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, JSON.stringify(payload, null, 2), "utf-8");

  return { path: baselinePath, count: baselineFindings.length, integrity: payload.integrity };
}

export async function loadBaseline(baselinePath) {
  if (!existsSync(baselinePath)) {
    return null;
  }

  const raw = await readFile(baselinePath, "utf-8");
  const baseline = JSON.parse(raw);

  if (!baseline.version || baseline.version !== BASELINE_VERSION) {
    throw new Error(`Unsupported baseline version: ${baseline.version}. Expected ${BASELINE_VERSION}.`);
  }

  const storedIntegrity = baseline.integrity;
  const payload = { ...baseline };
  delete payload.integrity;
  const computedIntegrity = computeIntegrity(payload);

  if (storedIntegrity !== computedIntegrity) {
    throw new Error("Baseline integrity check failed. File may have been tampered with.");
  }

  return baseline;
}

export function compareBaseline(currentFindings, baselineFindings, options = {}) {
  const maxLineDelta = options.maxLineDelta ?? 5;
  const baselineIds = new Set(baselineFindings.map((f) => f.id ?? findingIdentity(f)));
  const currentIds = new Set(currentFindings.map((f) => findingIdentity(f)));

  const baselineByType = new Map();
  for (const f of baselineFindings) {
    const typeId = findingTypeIdentity(f);
    if (!baselineByType.has(typeId)) baselineByType.set(typeId, []);
    baselineByType.get(typeId).push(f);
  }

  const newFindings = [];
  const resolvedFindings = [];
  const unchangedFindings = [];
  const shiftedFindings = [];

  for (const f of currentFindings) {
    const exactId = findingIdentity(f);
    if (baselineIds.has(exactId)) {
      unchangedFindings.push(f);
      continue;
    }

    const typeId = findingTypeIdentity(f);
    const candidates = baselineByType.get(typeId);
    if (candidates) {
      const currentLine = f.location?.line ?? f.line ?? 0;
      const match = candidates.find((b) => {
        const baselineLine = b.line ?? b.location?.line ?? 0;
        return Math.abs(currentLine - baselineLine) <= maxLineDelta;
      });
      if (match) {
        shiftedFindings.push({ ...f, _shiftedFrom: match.id ?? findingIdentity(match) });
        continue;
      }
    }

    newFindings.push(f);
  }

  for (const b of baselineFindings) {
    const id = b.id ?? findingIdentity(b);
    if (!currentIds.has(id)) {
      const typeId = findingTypeIdentity(b);
      const currentTypeMatch = currentFindings.some((f) => {
        const fTypeId = findingTypeIdentity(f);
        if (fTypeId !== typeId) return false;
        const currentLine = f.location?.line ?? f.line ?? 0;
        const baselineLine = b.line ?? 0;
        return Math.abs(currentLine - baselineLine) <= maxLineDelta;
      });
      if (!currentTypeMatch) {
        resolvedFindings.push(b);
      }
    }
  }

  return {
    new: newFindings,
    resolved: resolvedFindings,
    unchanged: unchangedFindings,
    shifted: shiftedFindings,
    summary: {
      newCount: newFindings.length,
      resolvedCount: resolvedFindings.length,
      unchangedCount: unchangedFindings.length,
      shiftedCount: shiftedFindings.length,
      totalCurrent: currentFindings.length,
      totalBaseline: baselineFindings.length
    }
  };
}

export async function checkGitignoreAwareness(repoRoot) {
  const gitignorePath = join(repoRoot, ".gitignore");
  const baselineFilePath = BASELINE_FILENAME;

  if (!existsSync(gitignorePath)) {
    return {
      hasGitignore: false,
      hasEntry: false,
      finding: {
        title: "No .gitignore found — baseline file should not be committed",
        severity: "info",
        category: "configuration",
        explanation: `.security-baseline.json should be in .gitignore to prevent committing security baseline data to version control.`,
        proposedFix: "Create a .gitignore file and add .security-baseline.json to it.",
        source: { ruleId: "repo-audit-baseline-gitignore", layer: "audit" }
      }
    };
  }

  const gitignoreContent = await readFile(gitignorePath, "utf-8");
  const hasEntry = gitignoreContent.split("\n").some((line) => {
    const trimmed = line.trim();
    return trimmed === baselineFilePath || trimmed === ".security-baseline*";
  });

  if (!hasEntry) {
    return {
      hasGitignore: true,
      hasEntry: false,
      finding: {
        title: ".security-baseline.json not in .gitignore",
        severity: "info",
        category: "configuration",
        explanation: "The security baseline file should be excluded from version control to prevent committing security scan results.",
        proposedFix: "Add .security-baseline.json to .gitignore.",
        source: { ruleId: "repo-audit-baseline-gitignore", layer: "audit" }
      }
    };
  }

  return { hasGitignore: true, hasEntry: true, finding: null };
}

export { BASELINE_FILENAME, BASELINE_VERSION, findingIdentity, findingTypeIdentity, computeIntegrity };