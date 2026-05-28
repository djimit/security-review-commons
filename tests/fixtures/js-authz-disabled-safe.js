export const adminRoute = {
  path: "/admin/export",
  authorizationRequired: true,
  handler(req, res) {
    return res.send(exportAccounts(req.query.accountId));
  }
};
