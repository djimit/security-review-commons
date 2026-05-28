export async function getInvoice(req) {
  return loadInvoiceForAccount(req.user.accountId);
}
