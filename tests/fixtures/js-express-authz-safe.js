app.get('/admin', (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).end();
  }
  return res.json({ ok: true });
});
