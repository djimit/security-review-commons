import { buildShellCommand } from "../lib/command.js";

export function runTask(req) {
  return buildShellCommand(req.query.name);
}
