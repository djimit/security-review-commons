function assertAllowedUrl(input: string): string {
  return new URL(input).toString();
}

interface RequestLike {
  query: {
    url: string;
  };
}

export async function proxy(req: RequestLike): Promise<Response> {
  const target = req.query.url;
  return fetch(assertAllowedUrl(target));
}
