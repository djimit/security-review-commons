export const token = "supersecret12345";

export function requireAdmin(user) {
  return Boolean(user?.isAdmin);
}
