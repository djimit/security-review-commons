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
  const commandsTarget = path.join(outputDir, "capture-commands.sh");
  fs.writeFileSync(commandsTarget, buildCommandSheet(outputDir));

  process.stdout.write(
    `${JSON.stringify({
      outputDir,
      worksheet: worksheetTarget,
      commands: commandsTarget,
      directories: ["raw", "accepted", "rejected"]
    })}\n`
  );
}

function buildCommandSheet(outputDir) {
  const escapedOutputDir = shellEscape(outputDir);
  const rawDir = `${escapedOutputDir}/raw`;

  return `#!/usr/bin/env bash
set -euo pipefail

# Generated runtime capture command sheet.
# Keep raw payloads in ${outputDir}/raw and review scrubbed fixture output before commit.

# Packaged plugin batch bootstrap
cat ${rawDir}/raw-plugin-post-write.json | npm run capture:fixture -- \\
  --runtime claude-plugin \\
  --event PostToolUse.Write \\
  --fixture ./tests/fixtures/plugin/post-tool-use-write.json \\
  --manifest ./tests/fixtures/runtime-fixtures.json \\
  --redact-paths tool_input.file_path \\
  --notes "Scrubbed live packaged-plugin payload for post-write review."

cat ${rawDir}/raw-plugin-pre-commit.json | npm run capture:fixture -- \\
  --runtime claude-plugin \\
  --event PreToolUse.Bash.git-commit \\
  --fixture ./tests/fixtures/plugin/pre-tool-use-bash-git-commit.json \\
  --manifest ./tests/fixtures/runtime-fixtures.json \\
  --redact-paths cwd \\
  --notes "Scrubbed live packaged-plugin payload for git commit checkpoint review."

cat ${rawDir}/raw-plugin-pre-push.json | npm run capture:fixture -- \\
  --runtime claude-plugin \\
  --event PreToolUse.Bash.git-push \\
  --fixture ./tests/fixtures/plugin/pre-tool-use-bash-git-push.json \\
  --manifest ./tests/fixtures/runtime-fixtures.json \\
  --redact-paths cwd \\
  --notes "Scrubbed live packaged-plugin payload for git push checkpoint review."

cat ${rawDir}/raw-plugin-stop.json | npm run capture:fixture -- \\
  --runtime claude-plugin \\
  --event Stop \\
  --fixture ./tests/fixtures/plugin/stop.json \\
  --manifest ./tests/fixtures/runtime-fixtures.json \\
  --redact-paths cwd \\
  --notes "Scrubbed live packaged-plugin payload for stop-turn review."

# OpenCode batch bootstrap
cat ${rawDir}/raw-opencode-file-edited.json | npm run capture:fixture -- \\
  --runtime opencode \\
  --event file.edited \\
  --fixture ./tests/fixtures/opencode/file-edited.json \\
  --manifest ./tests/fixtures/runtime-fixtures.json \\
  --notes "Scrubbed live OpenCode payload for file.edited normalization."

cat ${rawDir}/raw-opencode-session-diff.json | npm run capture:fixture -- \\
  --runtime opencode \\
  --event session.diff \\
  --fixture ./tests/fixtures/opencode/session-diff.json \\
  --manifest ./tests/fixtures/runtime-fixtures.json \\
  --notes "Scrubbed live OpenCode payload for session.diff normalization."

cat ${rawDir}/raw-opencode-session-idle.json | npm run capture:fixture -- \\
  --runtime opencode \\
  --event session.idle \\
  --fixture ./tests/fixtures/opencode/session-idle.json \\
  --manifest ./tests/fixtures/runtime-fixtures.json \\
  --notes "Scrubbed live OpenCode payload for session.idle normalization."

cat ${rawDir}/raw-opencode-tool-before-commit.json | npm run capture:fixture -- \\
  --runtime opencode \\
  --event tool.execute.before.git-commit \\
  --fixture ./tests/fixtures/opencode/tool-execute-before-commit.json \\
  --manifest ./tests/fixtures/runtime-fixtures.json \\
  --redact-paths workspace.root,repoRoot,cwd \\
  --notes "Scrubbed live OpenCode payload for git commit checkpoint normalization."

cat ${rawDir}/raw-opencode-tool-before-push.json | npm run capture:fixture -- \\
  --runtime opencode \\
  --event tool.execute.before.git-push \\
  --fixture ./tests/fixtures/opencode/tool-execute-before-push.json \\
  --manifest ./tests/fixtures/runtime-fixtures.json \\
  --redact-paths workspace.root,repoRoot,cwd \\
  --notes "Scrubbed live OpenCode payload for git push checkpoint normalization."

node --test tests/runtime-fixtures.test.js tests/adapters.test.js tests/plugin-hooks.test.js
`;
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

main();
