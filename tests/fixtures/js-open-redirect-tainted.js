export function handleRedirect(req, res) {
  return res.redirect(req.query.next);
}
