#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = {
    outputDir: "./runtime-capture-batch",
    worksheetName: "runtime-capture-worksheet.md"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--base-dir") {
      args.baseDir = next;
      index += 1;
    } else if (token === "--output-dir") {
      args.outputDir = next;
      index += 1;
    } else if (token === "--worksheet-name") {
      args.worksheetName = next;
      index += 1;
    }
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseDir = path.resolve(args.baseDir ?? process.cwd());
  const outputDir = path.resolve(baseDir, args.outputDir);
  const worksheetSource = path.resolve(
    baseDir,
    "docs/runtime-capture-worksheet.md"
  );

  fs.mkdirSync(path.join(outputDir, "raw"), { recursive: true });
  fs.mkdirSync(path.join(outputDir, "accepted"), { recursive: true });
  fs.mkdirSync(path.join(outputDir, "rejected"), { recursive: true });

  const worksheet = fs.readFileSync(worksheetSource, "utf8");
  const header = [
    "<!-- Copy raw payloads into ./raw and record accepted fixture paths in the worksheet. -->",
    "",
    `Created: ${new Date().toISOString()}`,
    `Source worksheet: ${path.relative(outputDir, worksheetSource) || "."}`,
    ""
  ].join("\n");

  const worksheetTarget = path.join(outputDir, args.worksheetName);
  fs.writeFileSync(worksheetTarget, `${header}${worksheet}`);

  process.stdout.write(
    `${JSON.stringify({
      outputDir,
      worksheet: worksheetTarget,
      directories: ["raw", "accepted", "rejected"]
    })}\n`
  );
}

main();
