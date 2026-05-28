export function RenderDanger(req) {
  return <div dangerouslySetInnerHTML={{ __html: req.query.html }} />;
}
