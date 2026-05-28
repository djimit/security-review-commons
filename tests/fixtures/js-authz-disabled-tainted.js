export const adminRoute = {
  path: "/admin/export",
  authorizationRequired: false,
  handler(req, res) {
    return res.send(exportAccounts(req.query.accountId));
  }
};
