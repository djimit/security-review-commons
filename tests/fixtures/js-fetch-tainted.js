export async function proxy(req) {
  const target = req.query.url;
  return fetch(target);
}

