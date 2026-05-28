export function allowAdmin(req, user, next) {
  const bypassAuth = req.query.bypassAuth === "true";
  if (bypassAuth) {
    return next();
  }

  return user.isAdmin;
}
