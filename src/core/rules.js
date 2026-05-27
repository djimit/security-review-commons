export const BUILTIN_RULES = [
  {
    id: "builtin-dangerous-child-process-shell-true",
    title: "Shell execution with shell:true",
    severity: "high",
    category: "command-injection",
    regex: /\b(exec|spawn)\s*\([^)]*shell\s*:\s*true/i,
    explanation:
      "Using shell:true expands command-injection risk when any command fragment can be attacker-controlled.",
    proposedFix:
      "Prefer direct argv execution without a shell and validate all untrusted inputs before process execution."
  },
  {
    id: "builtin-eval-detected",
    title: "Dynamic code execution via eval-like API",
    severity: "high",
    category: "code-injection",
    regex: /\b(eval|new Function|vm\.runIn(New)?Context)\s*\(/i,
    explanation:
      "Dynamic code execution is a common remote-code-execution sink when any attacker-controlled string reaches the evaluator.",
    proposedFix:
      "Remove eval-like execution or gate it behind a strict allowlist and trusted inputs."
  },
  {
    id: "builtin-path-join-user-input",
    title: "Potential path traversal via path join",
    severity: "medium",
    category: "path-traversal",
    regex: /\bpath\.(join|resolve)\s*\([^)]*(req\.|userInput|params\.|query\.)/i,
    explanation:
      "Joining attacker-controlled input into filesystem paths can allow traversal unless normalized and bounded.",
    proposedFix:
      "Validate allowed paths explicitly and enforce a trusted root after normalization."
  },
  {
    id: "builtin-hardcoded-secret-token",
    title: "Potential hardcoded credential",
    severity: "critical",
    category: "secret-exposure",
    regex: /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*['\"][^'\"]{8,}['\"]/i,
    explanation:
      "Hardcoded credentials are likely to leak through source control, logs, and downstream builds.",
    proposedFix:
      "Move the credential to a secret store or environment binding and rotate it."
  },
  {
    id: "builtin-unsafe-yaml-load",
    title: "Potential unsafe YAML deserialization",
    severity: "high",
    category: "unsafe-deserialization",
    regex: /\b(yaml|jsyaml)\.(load|unsafeLoad)\s*\(/i,
    explanation:
      "Generic YAML loaders can deserialize richer structures than intended and may be dangerous in untrusted-input paths.",
    proposedFix:
      "Use a safe schema or parser mode and treat YAML input as untrusted."
  },
  {
    id: "builtin-fetch-url-from-user-input",
    title: "Potential SSRF sink from attacker-controlled URL",
    severity: "medium",
    category: "ssrf",
    regex: /\b(fetch|axios\.(get|post|request)|got|request)\s*\([^)]*(req\.|userInput|params\.|query\.)/i,
    explanation:
      "Network requests built from attacker-controlled URLs can reach internal services or metadata endpoints.",
    proposedFix:
      "Validate schemes, hosts, ports, and destination allowlists before issuing outbound requests."
  }
];

