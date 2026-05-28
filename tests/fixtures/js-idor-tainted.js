export async function readInvoice(req, db) {
  return db.invoice.findByPk(req.params.invoiceId);
}
