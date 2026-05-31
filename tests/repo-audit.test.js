import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execSync } from "node:child_process";
import { runRepoAudit, REPO_AUDIT_PATTERNS, maskSecrets, inferFileLanguage } from "../src/core/repo-audit.js";

describe("repo-audit", () => {
  describe("maskSecrets", () => {
    it("masks OpenAI API keys", () => {
      const input = 'OPENAI_API_KEY="sk-proj-abcdefghij1234567890ABCDEFGHIJ"';
      const result = maskSecrets(input);
      assert.equal(result.includes("sk-proj-"), true);
      assert.equal(result.includes("abcdefghij1234567890"), false);
    });

    it("masks GitHub PATs", () => {
      const input = "GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
      const result = maskSecrets(input);
      assert.equal(result.includes("ghp_****"), true);
    });

    it("masks JWT tokens", () => {
      const input = "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const result = maskSecrets(input);
      assert.equal(result.includes("eyJ****.eyJ****"), true);
    });

    it("masks AWS access keys", () => {
      const input = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
      const result = maskSecrets(input);
      assert.equal(result.includes("AKIA****"), true);
    });

    it("preserves safe placeholders", () => {
      const input = "OPENAI_API_KEY=your-api-key-here";
      const result = maskSecrets(input);
      assert.equal(result, "OPENAI_API_KEY=your-api-key-here");
    });
  });

  describe("REPO_AUDIT_PATTERNS", () => {
    it("has valid structure for all patterns", () => {
      for (const pattern of REPO_AUDIT_PATTERNS) {
        assert.ok(pattern.id, `Pattern missing id: ${JSON.stringify(pattern)}`);
        assert.ok(pattern.title, `Pattern ${pattern.id} missing title`);
        assert.ok(pattern.severity, `Pattern ${pattern.id} missing severity`);
        assert.ok(["critical", "high", "medium", "low", "info"].includes(pattern.severity), `Pattern ${pattern.id} has invalid severity: ${pattern.severity}`);
        assert.ok(pattern.regex instanceof RegExp, `Pattern ${pattern.id} must have a regex`);
        assert.ok(pattern.explanation, `Pattern ${pattern.id} missing explanation`);
        assert.ok(pattern.proposedFix, `Pattern ${pattern.id} missing proposedFix`);
      }
    });

    it("detects OpenAI API keys", () => {
      const pattern = REPO_AUDIT_PATTERNS.find((p) => p.id === "repo-audit-openai-api-key");
      assert.ok(pattern.regex.test("sk-proj-hViD1234567890abcdefghij5YEA"));
    });

    it("detects GitHub PATs", () => {
      const pattern = REPO_AUDIT_PATTERNS.find((p) => p.id === "repo-audit-github-pat");
      assert.ok(pattern.regex.test("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij1234567890"));
    });

    it("detects private keys", () => {
      const pattern = REPO_AUDIT_PATTERNS.find((p) => p.id === "repo-audit-private-key");
      assert.ok(pattern.regex.test("-----BEGIN RSA PRIVATE KEY-----"));
      assert.ok(pattern.regex.test("-----BEGIN OPENSSH PRIVATE KEY-----"));
    });

    it("detects TLS bypass", () => {
      const pattern = REPO_AUDIT_PATTERNS.find((p) => p.id === "repo-audit-tls-verify-bypass");
      assert.ok(pattern.regex.test("rejectUnauthorized: false"));
      assert.ok(pattern.regex.test("ssl_verify = false"));
    });

    it("detects internal IPs", () => {
      const pattern = REPO_AUDIT_PATTERNS.find((p) => p.id === "repo-audit-internal-ip");
      assert.ok(pattern.regex.test("192.168.1.28"));
      assert.ok(pattern.regex.test("10.0.0.1"));
      assert.ok(pattern.regex.test("172.16.0.1"));
    });

    it("detects DB connection strings", () => {
      const pattern = REPO_AUDIT_PATTERNS.find((p) => p.id === "repo-audit-db-connection-string");
      assert.ok(pattern.regex.test("postgres://user:password@localhost:5432/mydb"));
    });
  });

  describe("runRepoAudit", () => {
    function initGitRepo(dir) {
      execSync("git init", { cwd: dir, stdio: "pipe" });
      execSync('git config user.email "test@test.com"', { cwd: dir, stdio: "pipe" });
      execSync('git config user.name "Test"', { cwd: dir, stdio: "pipe" });
    }

    function gitAddAndCommit(dir) {
      execSync("git add -A", { cwd: dir, stdio: "pipe" });
      execSync('git commit -m "test"', { cwd: dir, stdio: "pipe" });
    }

    it("scans a temporary repo directory and finds secrets", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-audit-test-"));
      try {
        initGitRepo(tmpDir);
        fs.writeFileSync(path.join(tmpDir, "config.env"), 'OPENAI_API_KEY="sk-proj-test1234567890test12345678"\nDB_URL="postgres://admin:password@localhost/db"\n');
        fs.writeFileSync(path.join(tmpDir, "deploy.sh"), "ssh -i ~/.ssh/mykey user@192.168.1.100\nrejectUnauthorized: false\n");
        fs.writeFileSync(path.join(tmpDir, "safe.txt"), "This file has no secrets\n");
        gitAddAndCommit(tmpDir);

        const result = runRepoAudit({ repoRoot: tmpDir });

        assert.ok(result.findings.length >= 2, `Expected at least 2 findings, got ${result.findings.length}`);
        assert.ok(
          result.findings.some((f) => f.category === "secret-exposure"),
          "Expected secret-exposure finding"
        );
        assert.ok(result.stats.filesScanned >= 2, "Should scan at least 2 files");
        assert.ok(typeof result.summary.total === "number", "Summary should have total");
        assert.ok(result.summary.critical >= 0, "Summary should have critical count");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("respects ignore patterns", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-audit-ignore-"));
      try {
        initGitRepo(tmpDir);
        fs.mkdirSync(path.join(tmpDir, "node_modules", "pkg"), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, "node_modules", "pkg", "index.js"), 'API_KEY="sk-proj-test1234567890pkg12345678"\n');
        fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, "src", "app.js"), "console.log('hello')\n");
        gitAddAndCommit(tmpDir);

        const result = runRepoAudit({ repoRoot: tmpDir });

        const nodeModulesFindings = result.findings.filter(
          (f) => f.files.some((file) => file.includes("node_modules"))
        );
        assert.equal(nodeModulesFindings.length, 0, "Should not flag node_modules");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("returns empty findings for a clean directory", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-audit-clean-"));
      try {
        initGitRepo(tmpDir);
        fs.writeFileSync(path.join(tmpDir, "README.md"), "# Hello World\n");
        fs.writeFileSync(path.join(tmpDir, ".env.example"), "OPENAI_API_KEY=your-key-here\n");
        gitAddAndCommit(tmpDir);

        const result = runRepoAudit({ repoRoot: tmpDir });

        assert.equal(result.findings.length, 0, "Clean directory should have no findings");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("audit rules compliance mapping", () => {
    it("every audit rule has complianceMapping with at least 1 entry", () => {
      for (const rule of REPO_AUDIT_PATTERNS) {
        assert.ok(rule.complianceMapping, `Rule ${rule.id} missing complianceMapping`);
        assert.ok(rule.complianceMapping.length >= 1, `Rule ${rule.id} has empty complianceMapping`);
      }
    });

    it("every audit rule has scanner, detectionMethod, falsePositiveRisk, remediationEffort", () => {
      for (const rule of REPO_AUDIT_PATTERNS) {
        assert.equal(rule.scanner, "pattern", `Rule ${rule.id} should be pattern scanner`);
        assert.equal(rule.detectionMethod, "pattern", `Rule ${rule.id} detectionMethod should be pattern`);
        assert.ok(["low", "medium", "high"].includes(rule.falsePositiveRisk), `Rule ${rule.id} invalid falsePositiveRisk`);
        assert.ok(["low", "medium", "high"].includes(rule.remediationEffort), `Rule ${rule.id} invalid remediationEffort`);
      }
    });

    it("secret-exposure audit rules map to BIO2 B.03", () => {
      const secretRules = REPO_AUDIT_PATTERNS.filter((r) => r.category === "secret-exposure");
      for (const rule of secretRules) {
        const bio2 = rule.complianceMapping.find((m) => m.framework === "BIO2");
        assert.ok(bio2, `Rule ${rule.id} missing BIO2 mapping`);
      }
    });

    it("inferFileLanguage returns expected languages", () => {
      assert.equal(inferFileLanguage("app.js"), "javascript");
      assert.equal(inferFileLanguage("app.ts"), "typescript");
      assert.equal(inferFileLanguage("app.py"), "python");
      assert.equal(inferFileLanguage("app.yml"), "yaml");
      assert.equal(inferFileLanguage("app.json"), "json");
      assert.equal(inferFileLanguage("Makefile"), null);
    });
  });
});