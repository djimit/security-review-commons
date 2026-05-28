export async function renderPreview(req) {
  return nunjucks.renderString(req.body.template, {
    user: req.user.name
  });
}
