type Config = {
  allowedUrl: string;
};

export async function proxy(config: Config): Promise<Response> {
  const target = config.allowedUrl;
  return fetch(target);
}

