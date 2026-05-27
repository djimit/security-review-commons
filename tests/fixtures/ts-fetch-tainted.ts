interface RequestLike {
  query: {
    url: string;
  };
}

export async function proxy(req: RequestLike): Promise<Response> {
  const target = req.query.url;
  return fetch(target);
}

