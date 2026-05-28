export async function getInvoice(req) {
  return loadInvoiceById(req.params.invoiceId);
}
