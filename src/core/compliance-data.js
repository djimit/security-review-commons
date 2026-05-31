const CATEGORY_COMPLIANCE_MAP = {
  "secret-exposure": [
    { framework: "BIO2", control: "B.03", title: "Identiteitsbeheer en toegangsbeheer", severity: "high" },
    { framework: "NORA", control: "IR.05", title: "Informatiebeveiliging", severity: "high" },
    { framework: "ISO27001", control: "A.9.2.2", title: "User authentication", severity: "high" },
    { framework: "NIST-CSF", control: "PR.AC", title: "Identity management and access control", severity: "high" },
    { framework: "OWASP", control: "A07:2021", title: "Identification and authentication failures", severity: "high" }
  ],
  "auth-bypass": [
    { framework: "BIO2", control: "B.03", title: "Identiteitsbeheer en toegangsbeheer", severity: "high" },
    { framework: "NORA", control: "IR.05", title: "Informatiebeveiliging", severity: "high" },
    { framework: "ISO27001", control: "A.9.4.2", title: "Secure log-on procedures", severity: "high" },
    { framework: "NIST-CSF", control: "PR.AC", title: "Identity management and access control", severity: "high" },
    { framework: "OWASP", control: "A01:2021", title: "Broken access control", severity: "high" }
  ],
  "command-injection": [
    { framework: "BIO2", control: "B.11", title: "Beheer van technische kwetsbaarheden", severity: "critical" },
    { framework: "NORA", control: "IR.06", title: "Kwetsbaarheden", severity: "critical" },
    { framework: "ISO27001", control: "A.8.8", title: "Management of technical vulnerabilities", severity: "critical" },
    { framework: "NIST-CSF", control: "PR.IP", title: "Protective technology", severity: "high" },
    { framework: "OWASP", control: "A03:2021", title: "Injection", severity: "critical" }
  ],
  "code-injection": [
    { framework: "BIO2", control: "B.11", title: "Beheer van technische kwetsbaarheden", severity: "critical" },
    { framework: "NORA", control: "IR.06", title: "Kwetsbaarheden", severity: "critical" },
    { framework: "ISO27001", control: "A.8.28", title: "Secure coding", severity: "critical" },
    { framework: "NIST-CSF", control: "PR.IP", title: "Protective technology", severity: "high" },
    { framework: "OWASP", control: "A03:2021", title: "Injection", severity: "critical" }
  ],
  "path-traversal": [
    { framework: "BIO2", control: "B.03", title: "Identiteitsbeheer en toegangsbeheer", severity: "high" },
    { framework: "NORA", control: "IR.05", title: "Informatiebeveiliging", severity: "high" },
    { framework: "ISO27001", control: "A.8.9", title: "Configuration management", severity: "high" },
    { framework: "NIST-CSF", control: "PR.AC", title: "Identity management and access control", severity: "high" },
    { framework: "OWASP", control: "A01:2021", title: "Broken access control", severity: "high" }
  ],
  "security-bypass": [
    { framework: "BIO2", control: "B.11", title: "Beheer van technische kwetsbaarheden", severity: "high" },
    { framework: "NORA", control: "IR.05", title: "Informatiebeveiliging", severity: "high" },
    { framework: "ISO27001", control: "A.8.24", title: "Use of cryptography", severity: "high" },
    { framework: "NIST-CSF", control: "PR.DS", title: "Data security", severity: "high" },
    { framework: "OWASP", control: "A02:2021", title: "Cryptographic failures", severity: "high" }
  ],
  "privacy-pii": [
    { framework: "AVG", control: "Art.5", title: "Verwerking van persoonsgegevens", severity: "high" },
    { framework: "EU-AI-ACT", control: "Art.10", title: "Data and data governance", severity: "medium" },
    { framework: "ISO27001", control: "A.5.34", title: "Privacy and protection of PII", severity: "high" },
    { framework: "NIST-CSF", control: "PR.DS", title: "Data security", severity: "medium" },
    { framework: "OWASP", control: "A01:2021", title: "Broken access control", severity: "medium" }
  ],
  "infrastructure-disclosure": [
    { framework: "BIO2", control: "B.08", title: "Bescherming tegen malware", severity: "medium" },
    { framework: "NORA", control: "IR.04", title: "Netwerkbeveiliging", severity: "medium" },
    { framework: "ISO27001", control: "A.8.22", title: "Segregation of networks", severity: "medium" },
    { framework: "NIST-CSF", control: "PR.AC", title: "Identity management and access control", severity: "medium" },
    { framework: "OWASP", control: "A05:2021", title: "Security misconfiguration", severity: "medium" }
  ],
  "xss": [
    { framework: "BIO2", control: "B.11", title: "Beheer van technische kwetsbaarheden", severity: "high" },
    { framework: "NORA", control: "IR.06", title: "Kwetsbaarheden", severity: "high" },
    { framework: "ISO27001", control: "A.8.28", title: "Secure coding", severity: "high" },
    { framework: "NIST-CSF", control: "PR.IP", title: "Protective technology", severity: "high" },
    { framework: "OWASP", control: "A03:2021", title: "Injection", severity: "high" }
  ],
  "deserialization": [
    { framework: "BIO2", control: "B.11", title: "Beheer van technische kwetsbaarheden", severity: "critical" },
    { framework: "NORA", control: "IR.06", title: "Kwetsbaarheden", severity: "critical" },
    { framework: "ISO27001", control: "A.8.28", title: "Secure coding", severity: "critical" },
    { framework: "NIST-CSF", control: "PR.IP", title: "Protective technology", severity: "high" },
    { framework: "OWASP", control: "A08:2021", title: "Software and data integrity failures", severity: "critical" }
  ],
  "dependency-confusion": [
    { framework: "BIO2", control: "B.11", title: "Beheer van technische kwetsbaarheden", severity: "high" },
    { framework: "NORA", control: "IR.06", title: "Kwetsbaarheden", severity: "high" },
    { framework: "ISO27001", control: "A.8.29", title: "Security in development and support", severity: "high" },
    { framework: "NIST-CSF", control: "PR.IP", title: "Protective technology", severity: "high" },
    { framework: "OWASP", control: "A06:2021", title: "Vulnerable and outdated components", severity: "high" }
  ],
  "sql-injection": [
    { framework: "BIO2", control: "B.11", title: "Beheer van technische kwetsbaarheden", severity: "critical" },
    { framework: "NORA", control: "IR.06", title: "Kwetsbaarheden", severity: "critical" },
    { framework: "ISO27001", control: "A.8.28", title: "Secure coding", severity: "critical" },
    { framework: "NIST-CSF", control: "PR.IP", title: "Protective technology", severity: "critical" },
    { framework: "OWASP", control: "A03:2021", title: "Injection", severity: "critical" }
  ]
};

const SEVERITY_FALSE_POSITIVE_RISK = {
  critical: "low",
  high: "medium",
  medium: "medium",
  low: "high",
  info: "high"
};

const SEVERITY_REMEDIATION_EFFORT = {
  critical: "high",
  high: "medium",
  medium: "low",
  low: "low",
  info: "low"
};

function getComplianceMappingForCategory(category) {
  return CATEGORY_COMPLIANCE_MAP[category] ?? [
    { framework: "ISO27001", control: "A.8.28", title: "Secure coding", severity: "medium" }
  ];
}

function getFalsePositiveRiskForSeverity(severity) {
  return SEVERITY_FALSE_POSITIVE_RISK[severity] ?? "medium";
}

function getRemediationEffortForSeverity(severity) {
  return SEVERITY_REMEDIATION_EFFORT[severity] ?? "medium";
}

export {
  CATEGORY_COMPLIANCE_MAP,
  SEVERITY_FALSE_POSITIVE_RISK,
  SEVERITY_REMEDIATION_EFFORT,
  getComplianceMappingForCategory,
  getFalsePositiveRiskForSeverity,
  getRemediationEffortForSeverity
};