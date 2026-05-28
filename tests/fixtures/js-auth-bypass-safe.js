export function allowAdmin(user) {
  if (!user.isAdmin) {
    return false;
  }

  return true;
}
