export async function readInvoice(db, invoiceId) {
  return db.invoice.findByPk(invoiceId);
}
