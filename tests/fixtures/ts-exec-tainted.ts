type RequestLike = {
  body: {
    command: string;
  };
};

export function run(req: RequestLike) {
  const command: string = req.body.command;
  return exec(command);
}

