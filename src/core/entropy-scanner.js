const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svgz",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".pdf", ".zip", ".gz", ".tar", ".rar", ".7z", ".bz2",
  ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".wav",
  ".exe", ".dll", ".so", ".dylib", ".a", ".o", ".obj",
  ".class", ".jar", ".war", ".pyc", ".pyd",
  ".ds_store", ".gitkeep"
]);

const LOCK_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "poetry.lock", "Gemfile.lock", "composer.lock", "Cargo.lock"
]);

const TEST_DIR_PATTERNS = [
  "/test/", "/tests/", "/__tests__/", "/spec/",
  "/fixtures/", "/mocks/", "/.test.", ".test.", ".spec."
];

function calculateEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] ?? 0) + 1;
  }
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

function extractStrings(content, minLength = 20) {
  const strings = [];
  const regex = /[^\s"'`,;:{}()[\]<>|&^%$#@!~`]+/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const s = match[0];
    if (s.length >= minLength) {
      strings.push({ value: s, index: match.index });
    }
  }
  return strings;
}

function isBinaryFile(filePath) {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function isLockFile(filePath) {
  const basename = filePath.substring(filePath.lastIndexOf("/") + 1);
  return LOCK_FILES.has(basename);
}

function getFalsePositiveRisk(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  for (const pattern of TEST_DIR_PATTERNS) {
    if (normalized.includes(pattern)) return "high";
  }
  return "medium";
}

function maskHighEntropyString(str) {
  if (str.length <= 12) return str.substring(0, 4) + "****";
  return str.substring(0, 8) + "****" + str.substring(str.length - 4);
}

function scanContentForHighEntropy(content, filePath, options = {}) {
  const threshold = options.entropyThreshold ?? 4.5;
  const minLength = options.minStringLength ?? 20;
  const findings = [];

  if (isBinaryFile(filePath) || isLockFile(filePath)) return findings;

  const strings = extractStrings(content, minLength);
  const falsePositiveRisk = getFalsePositiveRisk(filePath);

  for (const { value, index } of strings) {
    const entropy = calculateEntropy(value);
    if (entropy >= threshold) {
      const lineNumber = content.substring(0, index).split("\n").length;
      const startLine = Math.max(1, lineNumber - 1);
      const endLine = lineNumber + 1;
      const lines = content.split("\n");
      const precedingLine = startLine > 0 && startLine <= lines.length ? lines[startLine - 1] : "";
      const currentLine = lineNumber <= lines.length ? lines[lineNumber - 1] : "";
      const followingLine = endLine <= lines.length ? lines[endLine - 1] : "";
      const snippet = [precedingLine.trim(), currentLine.trim(), followingLine.trim()].filter(Boolean).join("\n");

      findings.push({
        ruleId: "repo-audit-entropy-high-entropy-string",
        title: "High-entropy string detected",
        severity: "medium",
        confidence: falsePositiveRisk === "high" ? "low" : "medium",
        category: "secret-exposure",
        detectionMethod: "entropy",
        falsePositiveRisk,
        remediationEffort: "medium",
        file: filePath,
        line: lineNumber,
        column: 1,
        entropyValue: entropy,
        stringValue: maskHighEntropyString(value),
        rawLength: value.length,
        complianceMapping: [
          { framework: "BIO2", control: "B.03", title: "Identiteitsbeheer en toegangsbeheer", severity: "high" },
          { framework: "NORA", control: "IR.05", title: "Informatiebeveiliging", severity: "high" },
          { framework: "OWASP", control: "A07:2021", title: "Identification and authentication failures", severity: "high" }
        ],
        snippet,
        masked: true
      });
    }
  }

  return findings;
}

function deduplicateWithPatternFindings(entropyFindings, patternFindings) {
  const patternAnchors = new Set();
  for (const f of patternFindings) {
    if (f.location?.file && f.location?.line) {
      patternAnchors.add(`${f.location.file}:${f.location.line}`);
    }
    if (f.exploitScenario) {
      const masked = maskHighEntropyString(f.exploitScenario);
      patternAnchors.add(masked);
    }
  }

  return entropyFindings.filter((f) => {
    const key = `${f.file}:${f.line}`;
    if (patternAnchors.has(key)) return false;
    if (f.stringValue && patternAnchors.has(f.stringValue)) return false;
    return true;
  });
}

export {
  calculateEntropy,
  extractStrings,
  isBinaryFile,
  isLockFile,
  getFalsePositiveRisk,
  maskHighEntropyString,
  scanContentForHighEntropy,
  deduplicateWithPatternFindings,
  BINARY_EXTENSIONS,
  LOCK_FILES,
  TEST_DIR_PATTERNS
};