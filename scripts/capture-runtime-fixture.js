#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { scrubRuntimeFixture } from "../src/adapters/runtime-fixtures.js";

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--base-dir") {
      args.baseDir = next;
      index += 1;
    } else if (token === "--runtime" || token === "--source") {
      args.runtime = next;
      index += 1;
    } else if (token === "--event") {
      args.event = next;
      index += 1;
    } else if (token === "--fixture" || token === "--output") {
      args.fixture = next;
      index += 1;
    } else if (token === "--manifest") {
      args.manifest = next;
      index += 1;
    } else if (token === "--home-dir") {
      args.homeDir = next;
      index += 1;
    } else if (token === "--redact-paths") {
      args.redactPaths = next
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const stdin = fs.readFileSync(0, "utf8");
  const payload = stdin.trim().length > 0 ? JSON.parse(stdin) : {};
  const baseDir = path.resolve(args.baseDir ?? process.cwd());
  const scrubbed = applyExplicitRedactions(
    scrubRuntimeFixture(payload, {
      homeDir: args.homeDir
    }),
    args.redactPaths ?? []
  );
  const output = JSON.stringify(scrubbed, null, 2);

  if (args.fixture) {
    const fixturePath = path.resolve(baseDir, args.fixture);
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
    fs.writeFileSync(fixturePath, `${output}\n`);
  } else {
    process.stdout.write(`${output}\n`);
    return;
  }

  let manifest = { entries: [] };
  if (args.manifest) {
    const manifestPath = path.resolve(baseDir, args.manifest);
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    }
    manifest.entries = Array.isArray(manifest.entries) ? manifest.entries : [];
    manifest.entries = manifest.entries.filter(
      (entry) => entry.fixture !== args.fixture
    );
    manifest.entries.push({
      runtime: args.runtime ?? "unknown",
      event: args.event ?? "unknown",
      fixture: args.fixture,
      source: "captured-live",
      scrubbed: true,
      capturedAt: new Date().toISOString(),
      supportedTopLevelFields: Object.keys(scrubbed).sort(),
      notes: "Scrubbed live runtime payload captured for adapter or plugin parity review."
    });
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(`${manifestPath}`, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  process.stdout.write(
    `${JSON.stringify({
      runtime: args.runtime ?? "unknown",
      event: args.event ?? "unknown",
      fixture: args.fixture,
      manifest: args.manifest ?? null,
      scrubbed: true
    })}\n`
  );
}

function applyExplicitRedactions(payload, redactPaths) {
  const clone = JSON.parse(JSON.stringify(payload));

  for (const redactPath of redactPaths) {
    setNestedValue(clone, redactPath, "<redacted>");
  }

  return clone;
}

function setNestedValue(target, dottedPath, replacement) {
  const parts = dottedPath.split(".").filter(Boolean);
  if (parts.length === 0) {
    return;
  }

  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!cursor || typeof cursor !== "object") {
      return;
    }
    cursor = cursor[parts[index]];
  }

  if (!cursor || typeof cursor !== "object") {
    return;
  }

  const lastKey = parts.at(-1);
  if (Object.hasOwn(cursor, lastKey)) {
    cursor[lastKey] = replacement;
  }
}

main();
