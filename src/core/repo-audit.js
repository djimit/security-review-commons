import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { makeFinding } from "./findings.js";
import { getComplianceMappingForCategory, getFalsePositiveRiskForSeverity, getRemediationEffortForSeverity } from "./compliance-data.js";
import { scanContentForHighEntropy, deduplicateWithPatternFindings, isBinaryFile, isLockFile } from "./entropy-scanner.js";

const MASK_REGEXES = [
  { pattern: /sk-proj-[a-zA-Z0-9]{4,}/g, replacement: "sk-proj-****" },
  { pattern: /sk-ant-api[a-zA-Z0-9-]{4,}/g, replacement: "sk-ant-api****" },
  { pattern: /sk-or-v1-[a-zA-Z0-9]{4,}/g, replacement: "sk-or-v1-****" },
  { pattern: /sk-lf-[a-zA-Z0-9]{4,}/g, replacement: "sk-lf-****" },
  { pattern: /ghp_[a-zA-Z0-9]{4,}/g, replacement: "ghp_****" },
  { pattern: /gho_[a-zA-Z0-9]{4,}/g, replacement: "gho_****" },
  { pattern: /AKIA[A-Z0-9]{4,}/g, replacement: "AKIA****" },
  { pattern: /AIza[A-Za-z0-9_-]{4,}/g, replacement: "AIza****" },
  { pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/g, replacement: "eyJ****.eyJ****" },
  { pattern: /tvly-dev-[a-zA-Z0-9]{4,}/g, replacement: "tvly-dev-****" },
  { pattern: /nvapi-[a-zA-Z0-9]{4,}/g, replacement: "nvapi-****" },
  { pattern: /xox[bap]-[a-zA-Z0-9-]{4,}/g, replacement: "xox*-****" },
  { pattern: /password\s*[:=]\s*["'][^"']{8,}["']/gi, replacement: "password=****" },
  { pattern: /token\s*[:=]\s*["'][^"']{8,}["']/gi, replacement: "token=****" },
];

function maskSecrets(text) {
  let result = text;
  for (const { pattern, replacement } of MASK_REGEXES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

const REPO_AUDIT_PATTERNS = [
  {
    id: "repo-audit-openai-api-key",
    title: "OpenAI API key detected",
    severity: "critical",
    confidence: "high",
    category: "secret-exposure",
    regex: /sk-proj-[a-zA-Z0-9]{20,}/,
    explanation: "OpenAI API keys grant access to GPT models and can incur significant costs if compromised.",
    proposedFix: "Rotate the key immediately. Move to environment variable or secret manager. Add to .gitignore.",
    layer: "audit"
  },
  {
    id: "repo-audit-anthropic-api-key",
    title: "Anthropic API key detected",
    severity: "critical",
    confidence: "high",
    category: "secret-exposure",
    regex: /sk-ant-api03-[a-zA-Z0-9]{20,}/,
    explanation: "Anthropic API keys grant access to Claude models and can incur significant costs if compromised.",
    proposedFix: "Rotate the key immediately. Move to environment variable or secret manager.",
    layer: "audit"
  },
  {
    id: "repo-audit-github-pat",
    title: "GitHub Personal Access Token detected",
    severity: "critical",
    confidence: "high",
    category: "secret-exposure",
    regex: /ghp_[a-zA-Z0-9]{36}/,
    explanation: "GitHub PATs grant repository access and can be used to push code, read private repos, or modify settings.",
    proposedFix: "Revoke the token on GitHub Settings > Developer settings > Personal access tokens. Use fine-grained tokens with minimal scope.",
    layer: "audit"
  },
  {
    id: "repo-audit-aws-access-key",
    title: "AWS Access Key ID detected",
    severity: "critical",
    confidence: "high",
    category: "secret-exposure",
    regex: /AKIA[A-Z0-9]{16}/,
    explanation: "AWS Access Key IDs identify an IAM user. The corresponding secret key is likely nearby.",
    proposedFix: "Rotate the access key in AWS IAM. Use IAM roles or temporary credentials instead.",
    layer: "audit"
  },
  {
    id: "repo-audit-google-api-key",
    title: "Google/Gemini API key detected",
    severity: "high",
    confidence: "high",
    category: "secret-exposure",
    regex: /AIza[A-Za-z0-9_-]{35,}/,
    explanation: "Google API keys can access Gemini, Maps, YouTube, and other services. Restrict key scope in Google Cloud Console.",
    proposedFix: "Restrict API key to specific services and HTTP referrers in Google Cloud Console. Rotate if key was public.",
    layer: "audit"
  },
  {
    id: "repo-audit-openrouter-key",
    title: "OpenRouter API key detected",
    severity: "critical",
    confidence: "high",
    category: "secret-exposure",
    regex: /sk-or-v1-[a-zA-Z0-9]{20,}/,
    explanation: "OpenRouter keys grant access to multiple LLM providers and can incur costs.",
    proposedFix: "Rotate the key. Move to environment variable or secret manager.",
    layer: "audit"
  },
  {
    id: "repo-audit-langfuse-key",
    title: "Langfuse secret key detected",
    severity: "high",
    confidence: "high",
    category: "secret-exposure",
    regex: /sk-lf-[a-zA-Z0-9]{20,}/,
    explanation: "Langfuse secret keys grant full access to observability data including prompts and model inputs.",
    proposedFix: "Rotate in Langfuse Settings > API Keys. Use public keys for client-side tracking.",
    layer: "audit"
  },
  {
    id: "repo-audit-deepseek-key",
    title: "DeepSeek API key detected",
    severity: "high",
    confidence: "high",
    category: "secret-exposure",
    regex: /sk-[a-f0-9]{32,}/,
    explanation: "DeepSeek API keys grant access to DeepSeek models. Rotate if exposed.",
    proposedFix: "Rotate the key. Use environment variables.",
    layer: "audit"
  },
  {
    id: "repo-audit-telegram-bot-token",
    title: "Telegram Bot token detected",
    severity: "high",
    confidence: "high",
    category: "secret-exposure",
    regex: /\d{8,10}:[a-zA-Z0-9_-]{30,}/,
    explanation: "Telegram Bot tokens allow full control of the bot account including sending messages and accessing group chats.",
    proposedFix: "Revoke via BotFather and create a new token. Move to environment variable.",
    layer: "audit"
  },
  {
    id: "repo-audit-jwt-token",
    title: "JWT token detected",
    severity: "high",
    confidence: "medium",
    category: "secret-exposure",
    regex: /eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{20,}/,
    explanation: "JWT tokens may contain sensitive claims and grant unauthorized access if not properly validated.",
    proposedFix: "Ensure this is not a production token. JWTs should be generated at runtime, not stored in source.",
    layer: "audit"
  },
  {
    id: "repo-audit-private-key",
    title: "Private key detected",
    severity: "critical",
    confidence: "high",
    category: "secret-exposure",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    explanation: "Private keys grant cryptographic identity and access. They should never be in source control.",
    proposedFix: "Rotate the key immediately. Store in a secret manager or hardware security module.",
    layer: "audit"
  },
  {
    id: "repo-audit-db-connection-string",
    title: "Database connection string with credentials detected",
    severity: "critical",
    confidence: "high",
    category: "secret-exposure",
    regex: /(?:mysql|postgres|mongodb|redis):\/\/[^:]+:[^@]+@[^\s"']+/i,
    explanation: "Database connection strings contain usernames and passwords. They should be environment variables.",
    proposedFix: "Move to environment variable. Rotate the database password if this was committed to a shared repository.",
    layer: "audit"
  },
  {
    id: "repo-audit-env-secret-file",
    title: "Environment file with secrets detected",
    severity: "critical",
    confidence: "medium",
    category: "secret-exposure",
    pathRegex: /\.(env|env\.local|env\.production)$/,
    regex: /(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE_KEY)\s*[:=]\s*["']?[a-zA-Z0-9_\-]{8,}["']?/i,
    explanation: "Environment files often contain production secrets and should not be committed to source control.",
    proposedFix: "Add to .gitignore. Use .env.example with placeholder values instead. Rotate any exposed secrets.",
    layer: "audit"
  },
  {
    id: "repo-audit-internal-ip",
    title: "Internal IP address disclosed",
    severity: "medium",
    confidence: "medium",
    category: "infrastructure-disclosure",
    regex: /(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})/,
    explanation: "Internal IP addresses reveal network topology and can aid targeted attacks. Use placeholders in documentation.",
    proposedFix: "Replace with <YOUR_IP> or 10.0.0.X placeholders in documentation and config examples.",
    layer: "audit"
  },
  {
    id: "repo-audit-ssh-identity",
    title: "SSH identity/key path in config",
    severity: "medium",
    confidence: "medium",
    category: "infrastructure-disclosure",
    regex: /(?:ssh\s+-i\s+|IdentityFile\s+)[^\s"']+/,
    explanation: "SSH key paths reveal host-specific configuration and key locations. Use environment variables or SSH config instead.",
    proposedFix: "Replace hardcoded key paths with SSH config entries or environment variables.",
    layer: "audit"
  },
  {
    id: "repo-audit-tls-verify-bypass",
    title: "TLS/SSL verification bypass detected",
    severity: "high",
    confidence: "high",
    category: "security-bypass",
    regex: /(?:rejectUnauthorized\s*[:=]\s*false|verify\s*[:=]\s*false|INSECURE|ssl_verify\s*[:=]\s*false|disable.*verify|skip.*verify)/i,
    explanation: "Disabling TLS verification exposes connections to man-in-the-middle attacks. Never use in production.",
    proposedFix: "Use proper CA certificates instead. Set NODE_TLS_REJECT_UNAUTHORIZED=0 only for local development with a clear TODO.",
    layer: "audit"
  },
  {
    id: "repo-audit-plaintext-password",
    title: "Hardcoded password detected",
    severity: "critical",
    confidence: "medium",
    category: "secret-exposure",
    regex: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/i,
    explanation: "Hardcoded passwords in source code are a critical security risk. Use environment variables or secret managers.",
    proposedFix: "Replace with environment variable reference. Rotate the password immediately.",
    layer: "audit"
  },
  {
    id: "repo-audit-email-address-pii",
    title: "Personal email address detected (PII)",
    severity: "low",
    confidence: "medium",
    category: "privacy-pii",
    regex: /[a-zA-Z0-9._%+-]+@(?!example\.com|test\.com|localhost|example\.org)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    explanation: "Personal email addresses in source code may constitute PII under GDPR/AVG. Use placeholders in public repos.",
    proposedFix: "Replace personal email addresses with role-based addresses (e.g., contact@example.com) or environment variables.",
    layer: "audit"
  }
];

for (const rule of REPO_AUDIT_PATTERNS) {
  if (!rule.scanner) rule.scanner = "pattern";
  if (!rule.detectionMethod) rule.detectionMethod = rule.scanner;
  if (!rule.falsePositiveRisk) rule.falsePositiveRisk = getFalsePositiveRiskForSeverity(rule.severity);
  if (!rule.remediationEffort) rule.remediationEffort = getRemediationEffortForSeverity(rule.severity);
  if (!rule.complianceMapping || rule.complianceMapping.length === 0) {
    rule.complianceMapping = getComplianceMappingForCategory(rule.category);
  }
}

function shouldIgnore(filePath, ignorePatterns) {
  if (!ignorePatterns) return false;
  const normalized = filePath.replace(/\\/g, "/");
  return ignorePatterns.some((pattern) => {
    if (pattern.endsWith("/")) {
      return normalized.startsWith(pattern) || normalized.includes("/" + pattern);
    }
    return normalized === pattern || normalized.endsWith("/" + pattern);
  });
}

function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function getGitTrackedFiles(repoRoot) {
  try {
    const output = execSync("git ls-files", {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 30_000
    });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function getGitModifiedFiles(repoRoot) {
  try {
    const output = execSync("git diff --name-only HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 10_000
    });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function inferFileLanguage(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const languageMap = {
    js: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
    jsx: "javascript",
    py: "python", pyw: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    yml: "yaml", yaml: "yaml",
    json: "json",
    env: "env",
    sh: "shell", bash: "shell",
    dockerfile: "dockerfile"
  };
  return languageMap[ext] ?? null;
}

function scanFileContent(content, filePath) {
  const findings = [];
  const fileLanguage = inferFileLanguage(filePath);
  for (const rule of REPO_AUDIT_PATTERNS) {
    if (rule.pathRegex && !rule.pathRegex.test(filePath)) continue;
    if (rule.language && rule.language !== fileLanguage) continue;
    const regex = rule.regex.global ? rule.regex : new RegExp(rule.regex.source, rule.regex.flags + "g");
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split("\n").length;
      findings.push(
        makeFinding({
          title: rule.title,
          severity: rule.severity,
          confidence: rule.confidence,
          category: rule.category,
          files: [filePath],
          explanation: rule.explanation,
          exploitScenario: maskSecrets(match[0]),
          proposedFix: rule.proposedFix,
          location: { file: filePath, line: lineNumber, column: 1 },
          source: { ruleId: rule.id, layer: "audit" },
          detectionMethod: rule.detectionMethod ?? "pattern",
          falsePositiveRisk: rule.falsePositiveRisk ?? "medium",
          remediationEffort: rule.remediationEffort ?? "medium",
          complianceMapping: rule.complianceMapping ?? []
        })
      );
    }
  }
  return findings;
}

function getGitRemotes(repoRoot) {
  try {
    const output = execSync("git remote -v", {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 5_000
    });
    return output.trim().split("\n").filter(Boolean).map((line) => {
      const parts = line.split(/\s+/);
      return { name: parts[0], url: parts[1], type: parts[2]?.replace(/[()]/g, "") };
    });
  } catch {
    return [];
  }
}

export function runRepoAudit({
  repoRoot = ".",
  ignorePatterns = [],
  includeGitHistory = false,
  maxFileSize = 1_000_000,
  enableEntropyScanner = true,
  entropyThreshold = 4.5
} = {}) {
  const startTime = Date.now();
  const allFindings = [];
  let linesScanned = 0;
  const stats = {
    filesScanned: 0,
    filesSkipped: 0,
    totalFiles: 0,
    linesScanned: 0,
    gitHistoryScanned: false,
    scanLayers: ["pattern-based", "contextual", "infrastructure-disclosure", "privacy-pii"],
    durationMs: 0
  };

  const trackedFiles = getGitTrackedFiles(repoRoot);
  stats.totalFiles = trackedFiles.length;

  const defaultIgnorePatterns = [
    "node_modules/",
    ".venv/",
    "venv/",
    "__pycache__/",
    ".git/",
    "dist/",
    "build/",
    "coverage/",
    ".next/",
    "vendor/",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml"
  ];
  const effectiveIgnorePatterns = [...defaultIgnorePatterns, ...ignorePatterns];

  for (const filePath of trackedFiles) {
    if (shouldIgnore(filePath, effectiveIgnorePatterns)) {
      stats.filesSkipped++;
      continue;
    }

    const fullPath = path.join(repoRoot, filePath);
    const stat = fs.statSync(fullPath, { throwIfNoEntry: false });
    if (!stat || stat.size > maxFileSize) {
      stats.filesSkipped++;
      continue;
    }

    const content = readFileContent(fullPath);
    if (!content) {
      stats.filesSkipped++;
      continue;
    }

    stats.filesScanned++;
    stats.linesScanned += content.split("\n").length;
    const fileFindings = scanFileContent(content, filePath);
    allFindings.push(...fileFindings);

    if (enableEntropyScanner && !isBinaryFile(filePath) && !isLockFile(filePath)) {
      const entropyFindings = scanContentForHighEntropy(content, filePath, { entropyThreshold });
      const deduped = deduplicateWithPatternFindings(entropyFindings, fileFindings);
      for (const ef of deduped) {
        allFindings.push(
          makeFinding({
            title: ef.title,
            severity: ef.severity,
            confidence: ef.confidence,
            category: ef.category,
            files: [ef.file],
            explanation: `High-entropy string detected (${ef.entropyValue.toFixed(2)} bits/char, ${ef.rawLength} characters). This may be an API key, token, or secret that doesn't match known prefix patterns.`,
            exploitScenario: ef.stringValue,
            proposedFix: "Verify the string is not a secret. If it is, move to environment variable or secret manager. If it is benign (e.g., a hash, encoded data), add a suppression.",
            location: { file: ef.file, line: ef.line, column: ef.column },
            source: { ruleId: ef.ruleId, layer: "audit" },
            detectionMethod: ef.detectionMethod,
            falsePositiveRisk: ef.falsePositiveRisk,
            remediationEffort: ef.remediationEffort ?? "medium",
            complianceMapping: ef.complianceMapping,
            evidence: ef.snippet ? { snippet: ef.snippet, startLine: ef.startLine, endLine: ef.endLine, masked: ef.masked } : null
          })
        );
      }
    }
  }

  const remotes = getGitRemotes(repoRoot);
  for (const remote of remotes) {
    if (remote.url.includes("@") && remote.url.includes(":")) {
      allFindings.push(
        makeFinding({
          title: "Git remote URL contains credentials",
          severity: "high",
          confidence: "high",
          category: "infrastructure-disclosure",
          files: [".git/config"],
          explanation: `Git remote '${remote.name}' URL contains user@host pattern which may include credentials: ${maskSecrets(remote.url)}`,
          proposedFix: "Use SSH keys instead of password-embedded URLs. Remove the remote with 'git remote remove <name>' and re-add with a credential-safe URL.",
          source: { ruleId: "repo-audit-git-remote-credentials", layer: "audit" }
        })
      );
    }
  }

  if (includeGitHistory) {
    stats.gitHistoryScanned = true;
    try {
      const historyOutput = execSync(
        "git log --all -p --diff-filter=AM -- '*.env' '*.key' '*.pem' '*/secrets/*' '*credentials*' '*auth.json'",
        { cwd: repoRoot, encoding: "utf8", timeout: 60_000 }
      );
      for (const rule of REPO_AUDIT_PATTERNS) {
        const regex = rule.regex.global ? rule.regex : new RegExp(rule.regex.source, rule.regex.flags + "g");
        let match;
        while ((match = regex.exec(historyOutput)) !== null) {
          const lineBefore = historyOutput.substring(Math.max(0, match.index - 100), match.index);
          const commitMatch = lineBefore.match(/^commit ([a-f0-9]{8})/m);
          allFindings.push(
            makeFinding({
              title: `${rule.title} (found in git history)`,
              severity: "high",
              confidence: rule.confidence,
              category: rule.category,
              files: ["(git history)"],
              explanation: `${rule.explanation} This secret was found in git history and may still be recoverable even if removed from current files.`,
              proposedFix: "Rotate the secret and use git filter-repo or BFG Repo-Cleaner to remove from history.",
              source: { ruleId: `${rule.id}-history`, layer: "audit" }
            })
          );
        }
      }
    } catch {
      // git history scan is optional
    }
  }

  stats.durationMs = Date.now() - startTime;

  return {
    repoRoot: path.resolve(repoRoot),
    findings: allFindings,
    stats,
    summary: {
      critical: allFindings.filter((f) => f.severity === "critical").length,
      high: allFindings.filter((f) => f.severity === "high").length,
      medium: allFindings.filter((f) => f.severity === "medium").length,
      low: allFindings.filter((f) => f.severity === "low").length,
      info: allFindings.filter((f) => f.severity === "info").length,
      total: allFindings.length
    }
  };
}

export function auditReportToMarkdown(result) {
  const lines = [
    "# Repository Security Audit Report",
    "",
    `**Repository:** ${result.repoRoot}`,
    `**Files scanned:** ${result.stats.filesScanned}`,
    `**Lines scanned:** ${result.stats.linesScanned}`,
    `**Git history:** ${result.stats.gitHistoryScanned ? "yes" : "no"}`,
    "",
    "## Findings by Severity",
    ""
  ];

  for (const [severity, count] of Object.entries(result.summary)) {
    if (severity === "total") {
      lines.push(`- **Total:** ${count}`);
    } else if (count > 0) {
      lines.push(`- ${severity}: ${count}`);
    }
  }

  if (result.findings.length === 0) {
    lines.push("", "No findings. Repository appears clean.");
    return lines.join("\n");
  }

  lines.push("", "## Findings", "");

  for (const finding of result.findings) {
    lines.push(`### ${finding.severity.toUpperCase()} — ${finding.title}`);
    lines.push("");
    lines.push(`- **Category:** ${finding.category}`);
    lines.push(`- **Rule:** ${finding.source?.ruleId ?? finding.id}`);
    lines.push(`- **Files:** ${finding.files.join(", ")}`);
    if (finding.explanation) {
      lines.push("", `**Explanation:** ${finding.explanation}`);
    }
    if (finding.proposedFix) {
      lines.push("", `**Fix:** ${finding.proposedFix}`);
    }
    if (finding.exploitScenario) {
      lines.push("", `**Exploit scenario:** ${finding.exploitScenario}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export { REPO_AUDIT_PATTERNS, maskSecrets, inferFileLanguage };