#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import { handleClaudeHook } from "../src/plugin/claude-hooks.js";

const mode = process.argv[2];

if (!mode) {
  throw new Error("Hook mode is required");
}

const stdin = fs.readFileSync(0, "utf8");
const input = stdin.trim().length > 0 ? JSON.parse(stdin) : {};
const response = handleClaudeHook({ mode, input });
process.stdout.write(`${JSON.stringify(response)}\n`);
