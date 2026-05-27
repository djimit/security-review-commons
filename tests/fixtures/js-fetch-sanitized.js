function validateUrl(input) {
  return new URL(input).toString();
}

export async function proxy(req) {
  const target = req.query.url;
  return fetch(validateUrl(target));
}
