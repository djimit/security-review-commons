import process from "node:process";

export function emitDebugEvent({ enabled, stream = process.stderr, event }) {
  if (!enabled) {
    return;
  }

  stream.write(
    `${JSON.stringify({
      source: "security-review-commons",
      kind: "debug",
      ...event
    })}\n`
  );
}

export function parseAuditEvent(auditEvent) {
  try {
    return JSON.parse(auditEvent);
  } catch {
    return { rawAuditEvent: auditEvent };
  }
}
