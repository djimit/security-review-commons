export async function proxy(config) {
  const target = config.allowedUrl;
  return fetch(target);
}

