import { exec } from "node:child_process";

export function buildShellCommand(command) {
  return exec(command, { shell: true });
}
