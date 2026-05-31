import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateEntropy,
  extractStrings,
  isBinaryFile,
  isLockFile,
  getFalsePositiveRisk,
  maskHighEntropyString,
  isLikelyBenignHighEntropy,
  shouldIgnoreString,
  scanContentForHighEntropy,
  deduplicateWithPatternFindings
} from "../src/core/entropy-scanner.js";

describe("entropy-scanner", () => {
  describe("calculateEntropy", () => {
    it("returns 0 for empty string", () => {
      assert.equal(calculateEntropy(""), 0);
    });

    it("returns high entropy for random-looking strings", () => {
      const apiKey = "sk-proj-abcdefghij1234567890ABCDEFGHIJ";
      const entropy = calculateEntropy(apiKey);
      assert.ok(entropy >= 4.0, `Expected entropy >= 4.0 for API key, got ${entropy}`);
    });

    it("returns low entropy for repetitive strings", () => {
      const repetitive = "aaaaaaaaaaaaaaaaaaaa";
      const entropy = calculateEntropy(repetitive);
      assert.ok(entropy < 1.0, `Expected entropy < 1.0 for repetitive, got ${entropy}`);
    });

    it("returns moderate entropy for mixed strings", () => {
      const mixed = "hello_world_12345";
      const entropy = calculateEntropy(mixed);
      assert.ok(entropy >= 2.0 && entropy < 5.0, `Expected moderate entropy, got ${entropy}`);
    });
  });

  describe("extractStrings", () => {
    it("extracts strings of minimum length", () => {
      const content = 'const short = "hi"; const long = "sk-proj-abcdefghij1234567890ABC";';
      const strings = extractStrings(content, 20);
      assert.ok(strings.length >= 1, "Should extract at least one long string");
      assert.ok(strings.some((s) => s.value.includes("sk-proj")), "Should find the API key");
    });

    it("ignores strings below minimum length", () => {
      const content = "const x = 'short';";
      const strings = extractStrings(content, 20);
      assert.equal(strings.length, 0, "Should find no strings below minLength");
    });
  });

  describe("isBinaryFile", () => {
    it("identifies binary extensions", () => {
      assert.ok(isBinaryFile("image.png"));
      assert.ok(isBinaryFile("archive.zip"));
      assert.ok(isBinaryFile("font.woff2"));
      assert.ok(isBinaryFile("video.mp4"));
    });

    it("allows source code files", () => {
      assert.ok(!isBinaryFile("app.js"));
      assert.ok(!isBinaryFile("config.py"));
      assert.ok(!isBinaryFile("style.css"));
    });
  });

  describe("isLockFile", () => {
    it("identifies lock files", () => {
      assert.ok(isLockFile("package-lock.json"));
      assert.ok(isLockFile("yarn.lock"));
      assert.ok(isLockFile("pnpm-lock.yaml"));
    });

    it("allows normal source files", () => {
      assert.ok(!isLockFile("app.js"));
      assert.ok(!isLockFile("index.ts"));
    });
  });

  describe("getFalsePositiveRisk", () => {
    it("returns high for test directories", () => {
      assert.equal(getFalsePositiveRisk("src/test/utils.test.js"), "high");
      assert.equal(getFalsePositiveRisk("tests/integration/api.test.js"), "high");
      assert.equal(getFalsePositiveRisk("src/__tests__/app.test.js"), "high");
    });

    it("returns medium for normal directories", () => {
      assert.equal(getFalsePositiveRisk("src/app.js"), "medium");
      assert.equal(getFalsePositiveRisk("config/settings.json"), "medium");
    });
  });

  describe("maskHighEntropyString", () => {
    it("masks long strings with first 8 and last 4 characters", () => {
      const masked = maskHighEntropyString("sk-proj-abcdefghij1234567890ABCDEFGHIJ");
      assert.ok(masked.startsWith("sk-proj-"));
      assert.ok(masked.endsWith("GHIJ"));
      assert.ok(masked.includes("****"));
    });

    it("masks short strings with first 4 and stars", () => {
      const masked = maskHighEntropyString("shortkey1234");
      assert.ok(masked.startsWith("shor"));
      assert.ok(masked.includes("****"));
    });
  });

  describe("scanContentForHighEntropy", () => {
    it("detects high-entropy strings above threshold", () => {
      const content = 'const API_KEY = "xK9mP2vN8qR5wL3jF7tY1hB4sD6gH0aZ";';
      const findings = scanContentForHighEntropy(content, "config.js", { entropyThreshold: 4.0 });
      assert.ok(findings.length >= 1, "Should detect high-entropy string");
      assert.equal(findings[0].ruleId, "repo-audit-entropy-high-entropy-string");
      assert.equal(findings[0].detectionMethod, "entropy");
      assert.equal(findings[0].severity, "medium");
    });

    it("skips low-entropy strings below threshold", () => {
      const content = 'const name = "hellohellohellohellohellohellohello";';
      const findings = scanContentForHighEntropy(content, "app.js", { entropyThreshold: 4.5 });
      assert.ok(findings.length === 0, "Should not find high-entropy strings in repetitive text");
    });

    it("skips binary files entirely", () => {
      const content = "content with random bytes";
      const findings = scanContentForHighEntropy(content, "image.png");
      assert.equal(findings.length, 0, "Should skip binary files");
    });

    it("skips lock files entirely", () => {
      const content = "content with hashes";
      const findings = scanContentForHighEntropy(content, "package-lock.json");
      assert.equal(findings.length, 0, "Should skip lock files");
    });

    it("elevates falsePositiveRisk for test directories", () => {
      const content = 'const key = "xK9mP2vN8qR5wL3jF7tY1hB4sD6gH0aZ";';
      const findings = scanContentForHighEntropy(content, "test/utils.test.js", { entropyThreshold: 4.0 });
      assert.ok(findings.length >= 1);
      assert.equal(findings[0].falsePositiveRisk, "high", "Test directory findings should have high false positive risk");
    });

    it("respects custom entropy threshold", () => {
      const content = 'const key = "xK9mP2vN8qR5wL3jF7tY1hB4sD6gH0aZ";';
      const findings5 = scanContentForHighEntropy(content, "app.js", { entropyThreshold: 5.5 });
      const findings3 = scanContentForHighEntropy(content, "app.js", { entropyThreshold: 3.0 });
      assert.ok(findings3.length >= findings5.length, "Lower threshold should find at least as many");
    });

    it("includes compliance mapping on findings", () => {
      const content = 'const key = "xK9mP2vN8qR5wL3jF7tY1hB4sD6gH0aZ";';
      const findings = scanContentForHighEntropy(content, "app.js", { entropyThreshold: 4.0 });
      assert.ok(findings.length >= 1, "Should find at least one finding");
      assert.ok(findings[0].complianceMapping.length >= 1, "Should have compliance mapping");
      assert.ok(findings[0].complianceMapping.some((m) => m.framework === "BIO2"), "Should map to BIO2");
    });

    it("produces masked evidence", () => {
      const content = 'const key = "xK9mP2vN8qR5wL3jF7tY1hB4sD6gH0aZ";';
      const findings = scanContentForHighEntropy(content, "app.js", { entropyThreshold: 4.0 });
      assert.ok(findings.length >= 1);
      assert.equal(findings[0].masked, true, "Evidence should be masked");
      assert.ok(findings[0].stringValue.includes("****"), "String value should be masked");
    });
  });

  describe("deduplicateWithPatternFindings", () => {
    it("removes entropy findings that overlap with pattern findings", () => {
      const patternFindings = [
        {
          location: { file: "config.env", line: 5, column: 1 },
          exploitScenario: "sk-proj-****"
        }
      ];
      const entropyFindings = [
        { file: "config.env", line: 5, stringValue: "sk-proj-****", line: 5 }
      ];
      const result = deduplicateWithPatternFindings(entropyFindings, patternFindings);
      assert.equal(result.length, 0, "Should deduplicate overlapping findings");
    });

    it("keeps entropy findings that don't overlap with pattern findings", () => {
      const patternFindings = [
        {
          location: { file: "other.env", line: 10, column: 1 },
          exploitScenario: "ghp_****"
        }
      ];
      const entropyFindings = [
        { file: "config.env", line: 5, stringValue: "a8f3****1a8", line: 5 }
      ];
      const result = deduplicateWithPatternFindings(entropyFindings, patternFindings);
      assert.equal(result.length, 1, "Should keep non-overlapping entropy findings");
    });
  });

  describe("isLikelyBenignHighEntropy", () => {
    it("filters out URLs", () => {
      assert.ok(isLikelyBenignHighEntropy("https://api.example.com/v2/organizations/org-id-12345/users"), "URLs should be filtered");
    });

    it("filters out UUIDs", () => {
      assert.ok(isLikelyBenignHighEntropy("550e8400-e29b-41d4-a716-446655440000"), "UUIDs should be filtered");
    });

    it("filters out SHA hashes", () => {
      assert.ok(isLikelyBenignHighEntropy("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"), "SHA-256 hashes should be filtered");
    });

    it("filters out JSON keys", () => {
      assert.ok(isLikelyBenignHighEntropy('"database_connection_string_primary":'), "JSON keys should be filtered");
    });

    it("does not filter real API keys", () => {
      assert.ok(!isLikelyBenignHighEntropy("sk_live_FAKE_TEST_KEY_NOT_REAL_1234567890"), "API key patterns should not be filtered");
    });

    it("does not filter high-entropy random strings", () => {
      assert.ok(!isLikelyBenignHighEntropy("xK9mP2vN8qR5wL3jF7tY1hB4sD6gH0aZ"), "Random strings should not be filtered");
    });

    it("filters out numeric IDs", () => {
      assert.ok(isLikelyBenignHighEntropy("1234567890-0987654321"), "Numeric IDs should be filtered");
    });
  });

  describe("FP reduction in scanContentForHighEntropy", () => {
    it("does not flag URLs as high-entropy secrets", () => {
      const content = 'const url = "https://api.example.com/v2/organizations/org-id-12345/users";';
      const findings = scanContentForHighEntropy(content, "src/config.js", { entropyThreshold: 4.0 });
      const urlFindings = findings.filter(f => f.stringValue.includes("https://"));
      assert.equal(urlFindings.length, 0, "URLs should not be flagged");
    });

    it("does not flag UUIDs as high-entropy secrets", () => {
      const content = 'const id = "550e8400-e29b-41d4-a716-446655440000";';
      const findings = scanContentForHighEntropy(content, "src/app.js", { entropyThreshold: 3.0 });
      const uuidFindings = findings.filter(f => f.stringValue.includes("550e"));
      assert.equal(uuidFindings.length, 0, "UUIDs should not be flagged");
    });

    it("does not flag SHA hashes as high-entropy secrets", () => {
      const content = 'const hash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";';
      const findings = scanContentForHighEntropy(content, "src/utils.js", { entropyThreshold: 3.5 });
      const hashFindings = findings.filter(f => f.stringValue.includes("2cf24dba"));
      assert.equal(hashFindings.length, 0, "SHA hashes should not be flagged");
    });

    it("respects ignorePatterns option", () => {
      const content = 'const API_KEY = "xK9mP2vN8qR5wL3jF7tY1hB4sD6gH0aZ";';
      const findings = scanContentForHighEntropy(content, "app.js", { entropyThreshold: 4.0, ignorePatterns: ["xK9m.*"] });
      assert.equal(findings.length, 0, "Should ignore strings matching ignorePatterns");
    });

    it("respects ignorePatterns as regex", () => {
      const content = 'const key = "xK9mP2vN8qR5wL3jF7tY1hB4sD6gH0aZ";';
      const findingsNoIgnore = scanContentForHighEntropy(content, "app.js", { entropyThreshold: 4.0 });
      const findingsWithIgnore = scanContentForHighEntropy(content, "app.js", { entropyThreshold: 4.0, ignorePatterns: [/xK9m/i] });
      assert.ok(findingsNoIgnore.length > 0, "Without ignore, should find high-entropy");
      assert.equal(findingsWithIgnore.length, 0, "With ignore regex, should skip matching strings");
    });
  });
});