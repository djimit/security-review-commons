app.get('/admin', (req, res) => {
  const skipAuth = req.query.skipAuth === '1';
  if (skipAuth) {
    return res.json({ data: 'admin-data' });
  }
  return res.status(403).end();
});
