const SENSITIVE_KEY_REGEX =
  /(api[_-]?key|authorization|cookie|password|secret|token)/i;
const PATH_KEY_REGEX =
  /(cwd|file|path|repo|root|workspace)/i;
const ABSOLUTE_PATH_REGEX = /(^\/|^[A-Za-z]:[\\/])/;
const SECRET_ASSIGNMENT_REGEX =
  /\b(api[_-]?key|password|secret|token)\b(\s*[:=]\s*["'])[^"']{4,}(["'])/gi;
const BEARER_TOKEN_REGEX = /\bBearer\s+[A-Za-z0-9._-]+\b/gi;

export function scrubRuntimeFixture(payload, options = {}) {
  const context = {
    homeDir: options.homeDir ?? process.env.HOME ?? null
  };

  return scrubValue(payload, context, null);
}

function scrubValue(value, context, key) {
  if (Array.isArray(value)) {
    return value.map((entry) => scrubValue(entry, context, key));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        scrubValue(entryValue, context, entryKey)
      ])
    );
  }
  if (typeof value !== "string") {
    return value;
  }

  if (key && SENSITIVE_KEY_REGEX.test(key)) {
    return "<REDACTED>";
  }

  if (key && PATH_KEY_REGEX.test(key) && ABSOLUTE_PATH_REGEX.test(value)) {
    return scrubPathString(value, context);
  }

  return scrubFreeformString(value, context);
}

function scrubPathString(value, context) {
  if (context.homeDir && value.startsWith(context.homeDir)) {
    return value.replace(context.homeDir, "<HOME>");
  }
  return "<ABSOLUTE_PATH>";
}

function scrubFreeformString(value, context) {
  let scrubbed = value.replace(
    SECRET_ASSIGNMENT_REGEX,
    (_, name, prefix, suffix) => `${name}${prefix}<REDACTED_SECRET>${suffix}`
  );
  scrubbed = scrubbed.replace(BEARER_TOKEN_REGEX, "Bearer <REDACTED_TOKEN>");

  if (context.homeDir) {
    scrubbed = scrubbed.split(context.homeDir).join("<HOME>");
  }

  return scrubbed;
}
