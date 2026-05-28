import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSuppressions,
  validateSuppressionGovernance
} from "../src/core/suppressions.js";

test("governance rejects high suppression without expiresOn", () => {
  const suppressions = normalizeSuppressions([
    {
      ruleId: "builtin-dangerous-child-process-shell-true",
      owner: "security@example.com",
      justification: "temporary acceptance",
      approvedBy: "lead@example.com",
      ticket: "SEC-101",
      createdOn: "2026-05-01"
    }
  ]);

  const violations = validateSuppressionGovernance(suppressions);
  assert.ok(violations.some((v) => v.kind === "missing-expiresOn"));
});

test("governance rejects critical suppression without owner domain policy", () => {
  const suppressions = normalizeSuppressions([
    {
      ruleId: "builtin-hardcoded-secret-token",
      owner: "security-team",
      justification: "temporary acceptance",
      approvedBy: "lead@example.com",
      ticket: "SEC-102",
      createdOn: "2026-05-01",
      expiresOn: "2026-12-31"
    }
  ]);

  const violations = validateSuppressionGovernance(suppressions);
  assert.ok(violations.some((v) => v.kind === "missing-owner-domain-policy"));
});
