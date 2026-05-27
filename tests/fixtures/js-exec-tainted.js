export function run(req) {
  const command = req.body.command;
  return exec(command);
}

