const DEFAULT_CONFIG = {
  enabledLayers: ["edit", "turn", "commit"],
  caps: {
    maxDiffBytes: 64 * 1024,
    maxChangedFiles: 25,
    maxCustomPatterns: 50
  },
  repoGuidance: [],
  customPatterns: []
};

function assertStringArray(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
}

function compileSafeRegex(source, field) {
  if (typeof source !== "string" || source.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (source.length > 300) {
    throw new Error(`${field} is too long`);
  }
  return new RegExp(source, "i");
}

export function loadConfig(raw = {}) {
  const merged = {
    ...DEFAULT_CONFIG,
    ...raw,
    caps: {
      ...DEFAULT_CONFIG.caps,
      ...(raw.caps ?? {})
    },
    repoGuidance: [...DEFAULT_CONFIG.repoGuidance, ...(raw.repoGuidance ?? [])],
    customPatterns: [...DEFAULT_CONFIG.customPatterns, ...(raw.customPatterns ?? [])]
  };

  assertStringArray(merged.enabledLayers, "enabledLayers");
  assertStringArray(merged.repoGuidance, "repoGuidance");

  if (merged.customPatterns.length > merged.caps.maxCustomPatterns) {
    throw new Error("customPatterns exceeds maxCustomPatterns");
  }

  const compiledPatterns = merged.customPatterns.map((pattern) => {
    if (typeof pattern.id !== "string" || typeof pattern.title !== "string") {
      throw new Error("customPatterns entries need id and title");
    }
    return {
      ...pattern,
      compiledRegex: compileSafeRegex(pattern.regex, `${pattern.id}.regex`),
      compiledPathRegex: pattern.pathRegex
        ? compileSafeRegex(pattern.pathRegex, `${pattern.id}.pathRegex`)
        : null
    };
  });

  return {
    ...merged,
    customPatterns: compiledPatterns
  };
}

export { DEFAULT_CONFIG };

