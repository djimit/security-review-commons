export function RenderSafe() {
  return <div dangerouslySetInnerHTML={{ __html: "<p>ok</p>" }} />;
}
