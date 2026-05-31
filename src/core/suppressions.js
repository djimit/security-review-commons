import { BUILTIN_RULES } from "./rules.js";

const SEVERITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };
const RULE_SEVERITY_BY_ID = new Map(BUILTIN_RULES.map((rule) => [rule.id, rule.severity]));

function isIsoDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isExpired(expiresOn) {
  if (!expiresOn) {
    return false;
  }
  const expiry = new Date(`${expiresOn}T23:59:59.999Z`);
  return Number.isNaN(expiry.getTime()) ? false : Date.now() > expiry.getTime();
}

function suppressionSeverity(ruleId) {
  return RULE_SEVERITY_BY_ID.get(ruleId) ?? "low";
}

function isHighOrCritical(severity) {
  return (SEVERITY_ORDER[severity] ?? 0) >= SEVERITY_ORDER.high;
}

export function normalizeSuppressions(rawSuppressions = []) {
  if (!Array.isArray(rawSuppressions)) {
    throw new Error("suppressions must be an array");
  }

  return rawSuppressions.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`suppressions[${index}] must be an object`);
    }
    const {
      ruleId,
      pathRegex,
      expiresOn,
      owner,
      justification,
      approvedBy,
      ticket,
      createdOn,
      scope
    } = entry;
    if (typeof ruleId !== "string" || ruleId.length === 0) {
      throw new Error(`suppressions[${index}].ruleId must be a non-empty string`);
    }
    if (typeof owner !== "string" || owner.length === 0) {
      throw new Error(`suppressions[${index}].owner must be a non-empty string`);
    }
    if (typeof justification !== "string" || justification.length < 8) {
      throw new Error(
        `suppressions[${index}].justification must be a descriptive string`
      );
    }
    if (expiresOn && !isIsoDateString(expiresOn)) {
      throw new Error(
        `suppressions[${index}].expiresOn must use YYYY-MM-DD format`
      );
    }
    if (createdOn && !isIsoDateString(createdOn)) {
      throw new Error(
        `suppressions[${index}].createdOn must use YYYY-MM-DD format`
      );
    }

    return {
      ruleId,
      owner,
      justification,
      approvedBy: approvedBy ?? null,
      ticket: ticket ?? null,
      createdOn: createdOn ?? null,
      expiresOn: expiresOn ?? null,
      severity: suppressionSeverity(ruleId),
      compiledPathRegex: pathRegex ? new RegExp(pathRegex, "i") : null,
      scope: scope ?? "file"
    };
  });
}

export function validateSuppressionGovernance(suppressions) {
  const violations = [];

  suppressions.forEach((suppression, index) => {
    if (isExpired(suppression.expiresOn)) {
      violations.push({
        index,
        ruleId: suppression.ruleId,
        kind: "expired",
        message: `suppressions[${index}] is expired`
      });
    }

    if (isHighOrCritical(suppression.severity) && !suppression.expiresOn) {
      violations.push({
        index,
        ruleId: suppression.ruleId,
        kind: "missing-expiresOn",
        message:
          `suppressions[${index}].expiresOn is required for high/critical suppressions`
      });
    }

    if (!suppression.approvedBy || !suppression.ticket || !suppression.createdOn) {
      violations.push({
        index,
        ruleId: suppression.ruleId,
        kind: "missing-metadata",
        message:
          `suppressions[${index}] must include approvedBy, ticket, and createdOn`
      });
    }

    if (suppression.severity === "critical" && !/@/.test(suppression.owner)) {
      violations.push({
        index,
        ruleId: suppression.ruleId,
        kind: "missing-owner-domain-policy",
        message:
          `suppressions[${index}] on critical rules must use an owner with domain policy (example: team@example.com)`
      });
    }
  });

  return violations;
}

export function applySuppressions(findings, suppressions, options = {}) {
  const activeFindings = [];
  const suppressedFindings = [];

  for (const finding of findings) {
    const matchedSuppression = suppressions.find((suppression) => {
      if (suppression.ruleId !== finding.source.ruleId) {
        return false;
      }
      if (isExpired(suppression.expiresOn)) {
        return false;
      }
      if (suppression.scope === "repository" && options.mode !== "audit") {
        return false;
      }
      if (!suppression.compiledPathRegex && suppression.scope !== "repository") {
        return true;
      }
      if (suppression.scope === "repository") {
        return true;
      }
      return finding.files.some((file) => suppression.compiledPathRegex.test(file));
    });

    if (matchedSuppression) {
      suppressedFindings.push({
        ...finding,
        suppression: {
          owner: matchedSuppression.owner,
          justification: matchedSuppression.justification,
          approvedBy: matchedSuppression.approvedBy,
          ticket: matchedSuppression.ticket,
          createdOn: matchedSuppression.createdOn,
          expiresOn: matchedSuppression.expiresOn
        }
      });
      continue;
    }

    activeFindings.push(finding);
  }

  return { activeFindings, suppressedFindings };
}
