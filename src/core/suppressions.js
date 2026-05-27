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

export function normalizeSuppressions(rawSuppressions = []) {
  if (!Array.isArray(rawSuppressions)) {
    throw new Error("suppressions must be an array");
  }

  return rawSuppressions.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`suppressions[${index}] must be an object`);
    }
    const { ruleId, pathRegex, expiresOn, owner, justification } = entry;
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

    return {
      ruleId,
      owner,
      justification,
      expiresOn: expiresOn ?? null,
      compiledPathRegex: pathRegex ? new RegExp(pathRegex, "i") : null
    };
  });
}

export function applySuppressions(findings, suppressions) {
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
      if (!suppression.compiledPathRegex) {
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
          expiresOn: matchedSuppression.expiresOn
        }
      });
      continue;
    }

    activeFindings.push(finding);
  }

  return { activeFindings, suppressedFindings };
}

