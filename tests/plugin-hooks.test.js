import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("Plugin manifest and hooks config exist and reference the packaged entrypoint", () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, ".claude-plugin/plugin.json"),
      "utf8"
    )
  );
  const hooksConfig = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "hooks/hooks.json"), "utf8")
  );

  assert.equal(manifest.name, "security-review-commons");
  assert.equal(manifest.hooks, "./hooks/hooks.json");
  assert.equal(hooksConfig.hooks.PostToolUse[0].matcher, "Edit|Write|MultiEdit");
  assert.match(
    hooksConfig.hooks.PreToolUse[0].hooks[0].command,
    /bin\/plugin-security-hook\.js/
  );
  assert.match(
    hooksConfig.hooks.Stop[0].hooks[0].command,
    /bin\/plugin-security-hook\.js/
  );
});

test("Plugin post-edit hook replays deterministic edit feedback through the packaged entrypoint", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "src-plugin-hook-edit-"));
  const filePath = path.join(tempDir, "src/auth/login.js");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'const token = "supersecret12345";\n');

  const output = execFileSync(
    "node",
    ["./bin/plugin-security-hook.js", "post-edit"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: tempDir,
        CLAUDE_PLUGIN_ROOT: repoRoot
      },
      input: JSON.stringify({
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: filePath,
          content: 'const token = "supersecret12345";\n'
        }
      })
    }
  );

  const parsed = JSON.parse(output);
  assert.match(
    parsed.hookSpecificOutput.additionalContext,
    /Potential hardcoded credential/
  );
});

test("Plugin pre-bash hook blocks staged high-severity checkpoint findings", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "src-plugin-hook-git-"));
  const filePath = path.join(tempDir, "src/auth/login.js");

  execFileSync("git", ["init"], { cwd: tempDir, encoding: "utf8" });
  execFileSync("git", ["config", "user.name", "Test User"], {
    cwd: tempDir,
    encoding: "utf8"
  });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: tempDir,
    encoding: "utf8"
  });

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'const token = "supersecret12345";\n');
  execFileSync("git", ["add", "."], { cwd: tempDir, encoding: "utf8" });

  const output = execFileSync(
    "node",
    ["./bin/plugin-security-hook.js", "pre-bash"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: tempDir,
        CLAUDE_PLUGIN_ROOT: repoRoot
      },
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        cwd: tempDir,
        tool_input: {
          command: 'git commit -m "test commit"'
        }
      })
    }
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  assert.match(
    parsed.hookSpecificOutput.permissionDecisionReason,
    /Potential hardcoded credential/
  );
});

test("Plugin stop-turn hook blocks on configured turn-review findings", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "src-plugin-stop-hook-"));
  const filePath = path.join(tempDir, "src/auth/flow.js");

  execFileSync("git", ["init"], { cwd: tempDir, encoding: "utf8" });
  execFileSync("git", ["config", "user.name", "Test User"], {
    cwd: tempDir,
    encoding: "utf8"
  });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: tempDir,
    encoding: "utf8"
  });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "export function auth() { return true; }\n");
  execFileSync("git", ["add", "."], { cwd: tempDir, encoding: "utf8" });
  execFileSync("git", ["commit", "-m", "baseline"], {
    cwd: tempDir,
    encoding: "utf8"
  });

  fs.writeFileSync(
    filePath,
    "export function auth(bypassAuth, user) {\n  if (bypassAuth) {\n    return user;\n  }\n}\n"
  );

  const output = execFileSync(
    "node",
    ["./bin/plugin-security-hook.js", "stop-turn"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: tempDir,
        CLAUDE_PLUGIN_ROOT: repoRoot,
        SECURITY_REVIEW_TURN_REVIEW_ENABLED: "true",
        SECURITY_REVIEW_TURN_REVIEW_PROVIDER: "mock",
        SECURITY_REVIEW_TURN_REVIEW_MODEL: "fixture",
        SECURITY_REVIEW_TURN_REVIEW_COMMAND: "node",
        SECURITY_REVIEW_TURN_REVIEW_ARGS:
          JSON.stringify(["./tests/fixtures/mock-turn-reviewer.js"])
      },
      input: JSON.stringify({
        hook_event_name: "Stop",
        cwd: tempDir
      })
    }
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.decision, "block");
  assert.match(parsed.reason, /authorization bypass/i);
});

test("Plugin pre-bash hook honors layer kill switches from the runtime environment", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "src-plugin-hook-skip-"));
  const filePath = path.join(tempDir, "src/auth/login.js");

  execFileSync("git", ["init"], { cwd: tempDir, encoding: "utf8" });
  execFileSync("git", ["config", "user.name", "Test User"], {
    cwd: tempDir,
    encoding: "utf8"
  });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: tempDir,
    encoding: "utf8"
  });

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'const token = "supersecret12345";\n');
  execFileSync("git", ["add", "."], { cwd: tempDir, encoding: "utf8" });

  const output = execFileSync(
    "node",
    ["./bin/plugin-security-hook.js", "pre-bash"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: tempDir,
        CLAUDE_PLUGIN_ROOT: repoRoot,
        SECURITY_REVIEW_ENABLED_LAYERS: "edit,turn,push"
      },
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        cwd: tempDir,
        tool_input: {
          command: 'git commit -m "test commit"'
        }
      })
    }
  );

  const parsed = JSON.parse(output);
  assert.equal(parsed.continue, true);
  assert.equal(parsed.hookSpecificOutput, undefined);
});

test("Plugin debug mode emits metadata-only stderr without leaking file contents", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "src-plugin-hook-debug-"));
  const filePath = path.join(tempDir, "src/auth/login.js");
  const secretLine = 'const token = "supersecret12345";\n';

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, secretLine);

  const result = spawnSync(
    "node",
    ["./bin/plugin-security-hook.js", "post-edit"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: tempDir,
        CLAUDE_PLUGIN_ROOT: repoRoot,
        SECURITY_REVIEW_DEBUG: "true"
      },
      input: JSON.stringify({
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: filePath,
          content: secretLine
        }
      })
    }
  );

  assert.equal(result.status, 0);
  assert.match(result.stderr, /"source":"security-review-commons"/);
  assert.match(result.stderr, /"hookMode":"post-edit"/);
  assert.doesNotMatch(result.stderr, /supersecret12345/);
});
