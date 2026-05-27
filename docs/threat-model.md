# Threat Model

## Assets

- source code and diffs
- credentials and secret-like files
- repository policy files
- review findings and logs

## Trust Boundaries

1. Repository content can contain prompt injection.
2. Custom policy files can be malformed or malicious.
3. Tool output can be wrong, incomplete, or hostile.
4. Future model output can hallucinate or exfiltrate context.

## Main Risks

- secret leakage through logs or debug output
- path traversal in policy loading
- regex denial of service from custom patterns
- false trust in review output
- repo policy suppressing important findings

## Mitigations In This Slice

- metadata-only audit logging
- additive-only policy merge
- pattern count and diff size caps
- regex compilation guardrails
- stable finding schema

## Deferred Mitigations

- AST-based dataflow
- SARIF emission
- model isolation and independent reviewer prompts
- suppression expiry and owner metadata

