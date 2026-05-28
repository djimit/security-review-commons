export async function renderPreview(req) {
  const userName = req.user.name;
  return nunjucks.renderString("Hello {{ user }}", {
    user: userName
  });
}
