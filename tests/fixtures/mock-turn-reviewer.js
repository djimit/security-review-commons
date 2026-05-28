#!/usr/bin/env node
import fs from "node:fs";

const input = JSON.parse(fs.readFileSync(0, "utf8"));
const diff = input?.context?.diff ?? "";

if (/bypassAuth|skipAuthorization/i.test(diff)) {
  process.stdout.write(
    JSON.stringify({
      findings: [
        {
          title: "Potential authorization bypass in changed flow",
          severity: "high",
          confidence: "medium",
          category: "auth-bypass",
          explanation:
            "The changed diff appears to bypass an authorization or guard check.",
          proposedFix:
            "Restore the authorization check or add a stricter trusted boundary."
        }
      ]
    })
  );
  process.stdout.write("\n");
  process.exit(0);
}

process.stdout.write(`${JSON.stringify({ findings: [] })}\n`);
