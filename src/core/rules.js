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
  },
  {
    id: "builtin-open-redirect-from-user-input",
    title: "Potential open redirect from attacker-controlled target",
    severity: "medium",
    category: "open-redirect",
    regex: /\b(res|reply|response)\.redirect\s*\([^)]*(req\.|userInput|params\.|query\.)/i,
    explanation:
      "Redirect targets built from attacker-controlled input can enable phishing and token leakage.",
    proposedFix:
      "Redirect only to allowlisted internal paths or validated absolute destinations."
  },
  {
    id: "builtin-auth-bypass-flag",
    title: "Potential authorization bypass behind a flag",
    severity: "high",
    category: "auth-bypass",
    regex: /\bif\s*\(\s*(bypassAuth|skipAuth|disableAuth)\s*\)\s*\{[\s\S]{0,160}?\b(return\s+true|return\s+\w+|next\s*\()/i,
    explanation:
      "A bypass flag that short-circuits authorization logic can create a direct privilege-escalation path.",
    proposedFix:
      "Remove bypass flags from request or runtime flow, or gate them behind a trusted operator-only boundary with explicit auditing."
  },
  {
    id: "builtin-idor-direct-object-reference",
    title: "Potential insecure direct object reference from request identifier",
    severity: "high",
    category: "idor",
    regex: /\b(findByPk|findOne|findUnique|get|load)\s*\([^)]*(req\.(params|query)\.(id|[A-Za-z0-9_]*Id)|params\.(id|[A-Za-z0-9_]*Id)|query\.(id|[A-Za-z0-9_]*Id))/i,
    explanation:
      "Direct lookups of sensitive records from request identifiers can create IDOR risk when authorization is missing or deferred.",
    proposedFix:
      "Authorize access to the requested object before lookup or scope the query to the authenticated principal."
  },
  {
    id: "builtin-dangerously-set-inner-html-user-input",
    title: "Potential DOM XSS via dangerouslySetInnerHTML from untrusted input",
    severity: "high",
    category: "xss",
    regex: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*[^}]*?(req\.|userInput|params\.|query\.)/i,
    explanation:
      "Passing request-controlled HTML into dangerouslySetInnerHTML can create a direct DOM XSS sink.",
    proposedFix:
      "Avoid raw HTML rendering for untrusted input or sanitize against a strict allowlist before rendering."
  },
  {
    id: "builtin-template-render-user-input",
    title: "Potential server-side template injection from untrusted input",
    severity: "high",
    category: "template-injection",
    regex: /\b(ejs\.render|handlebars\.compile|mustache\.render|pug\.render)\s*\([^)]*(req\.|userInput|params\.|query\.)/i,
    explanation:
      "Passing request-controlled strings into server-side template compilation or rendering can create template-injection risk.",
    proposedFix:
      "Avoid compiling templates from untrusted input and treat template source as trusted application code only."
  },
  {
    id: "builtin-python-pickle-load",
    title: "Potential unsafe Python pickle deserialization",
    severity: "high",
    category: "unsafe-deserialization",
    pathRegex: /(^|\/).+\.py$/i,
    regex: /\bpickle\.(load|loads)\s*\(/i,
    explanation:
      "Python pickle deserialization can execute attacker-controlled code when input is not fully trusted.",
    proposedFix:
      "Avoid pickle on untrusted input or replace it with a safer serialization format and strict validation."
  },
  {
    id: "builtin-python-torch-load",
    title: "Potential unsafe torch model deserialization",
    severity: "high",
    category: "unsafe-deserialization",
    pathRegex: /(^|\/).+\.py$/i,
    regex: /\btorch\.load\s*\(/i,
    explanation:
      "torch.load may deserialize attacker-controlled pickled content and should not be used on untrusted artifacts.",
    proposedFix:
      "Load only trusted model artifacts, verify provenance, or use a safer format when possible."
  },
  {
    id: "builtin-python-subprocess-shell-true",
    title: "Potential unsafe Python subprocess shell execution",
    severity: "high",
    category: "command-injection",
    pathRegex: /(^|\/).+\.py$/i,
    regex: /\bsubprocess\.(run|Popen|call|check_call|check_output)\s*\([^)]*shell\s*=\s*True/i,
    explanation:
      "Python subprocess calls with shell=True expand command-injection risk when any argument can be attacker-controlled.",
    proposedFix:
      "Prefer argv-style subprocess execution without a shell and validate untrusted inputs before process execution."
  },
  {
    id: "builtin-github-actions-pull-request-target",
    title: "GitHub Actions workflow uses pull_request_target",
    severity: "high",
    category: "ci-trust-boundary",
    pathRegex: /(^|\/)\.github\/workflows\/.+\.(yml|yaml)$/i,
    regex: /\bpull_request_target\s*:/i,
    explanation:
      "pull_request_target runs with the base repository context and can become dangerous when combined with untrusted pull request content.",
    proposedFix:
      "Prefer pull_request unless write permissions or secrets are strictly required, and isolate any untrusted code paths."
  },
  {
    id: "builtin-github-actions-write-all-permissions",
    title: "GitHub Actions workflow grants broad write-all permissions",
    severity: "high",
    category: "ci-privilege",
    pathRegex: /(^|\/)\.github\/workflows\/.+\.(yml|yaml)$/i,
    regex: /\bpermissions\s*:\s*write-all\b/i,
    explanation:
      "write-all grants a broad token scope that increases blast radius for compromised workflow steps.",
    proposedFix:
      "Replace write-all with the minimum explicit permissions required by each workflow."
  },
  {
    id: "builtin-github-actions-curl-pipe-shell",
    title: "Workflow step pipes remote content into a shell",
    severity: "high",
    category: "supply-chain",
    pathRegex: /(^|\/)\.github\/workflows\/.+\.(yml|yaml)$/i,
    regex: /\bcurl\b[^\n|]*\|\s*(sh|bash)\b/i,
    explanation:
      "Piping remote network content directly into a shell removes reviewable integrity boundaries and increases supply-chain risk.",
    proposedFix:
      "Download artifacts explicitly, pin their source and checksum, and execute only verified local files."
  },
  {
    id: "builtin-dockerfile-missing-user",
    title: "Dockerfile does not appear to switch away from root",
    severity: "medium",
    category: "container-hardening",
    pathRegex: /(^|\/)(dockerfile|Dockerfile|.+\.dockerfile)$/i,
    test: (diff) => ({
      matched: !/^\s*USER\s+\S+/m.test(diff),
      location: { line: 1, column: 1 }
    }),
    explanation:
      "Containers that never set USER commonly run as root, increasing impact if the service is compromised.",
    proposedFix:
      "Create a dedicated unprivileged runtime user and switch to it before the final execution stage."
  },
  {
    id: "builtin-kubernetes-privileged-container",
    title: "Kubernetes manifest enables privileged container execution",
    severity: "high",
    category: "container-privilege",
    pathRegex: /(^|\/).+\.(yml|yaml)$/i,
    regex: /\bprivileged\s*:\s*true\b/i,
    explanation:
      "Privileged containers significantly expand kernel and host access, often beyond what an application needs.",
    proposedFix:
      "Avoid privileged mode unless there is a strong host-level requirement and document the exact need."
  },
  {
    id: "builtin-kubernetes-runas-root",
    title: "Kubernetes manifest explicitly runs as root",
    severity: "medium",
    category: "container-hardening",
    pathRegex: /(^|\/).+\.(yml|yaml)$/i,
    regex: /\brunAsUser\s*:\s*0\b/i,
    explanation:
      "Explicit root execution in Kubernetes increases the impact of container escape and application compromise.",
    proposedFix:
      "Use a non-root runtime user and pair it with read-only or least-privilege filesystem settings where possible."
  },
  {
    id: "builtin-terraform-public-ssh-ingress",
    title: "Terraform resource exposes SSH to the public internet",
    severity: "high",
    category: "network-exposure",
    pathRegex: /(^|\/).+\.tf$/i,
    regex: /((from_port|to_port)\s*=\s*22[\s\S]{0,220}cidr_blocks\s*=\s*\[[^\]]*"0\.0\.0\.0\/0"[^\]]*\])|(cidr_blocks\s*=\s*\[[^\]]*"0\.0\.0\.0\/0"[^\]]*\][\s\S]{0,220}(from_port|to_port)\s*=\s*22)/i,
    explanation:
      "Opening SSH to 0.0.0.0/0 is a high-noise exposure pattern that expands brute-force and credential-attack surface.",
    proposedFix:
      "Restrict SSH ingress to trusted administrator ranges or remove direct public SSH entirely."
  },
  {
    id: "builtin-package-json-unpinned-version",
    title: "package.json uses unpinned or catch-all dependency version",
    severity: "medium",
    category: "dependency-governance",
    pathRegex: /(^|\/)package\.json$/i,
    regex: /:\s*"(latest|\*|x)"/i,
    explanation:
      "Unpinned dependency selectors reduce change control and increase the chance of unexpected or malicious version drift.",
    proposedFix:
      "Use explicit versions or a narrow reviewed range and update intentionally."
  }
];
