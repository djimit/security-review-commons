export function lineColumnFromIndex(text, index) {
  const safeIndex = Math.max(0, Math.min(index, text.length));
  const prefix = text.slice(0, safeIndex);
  const line = prefix.split("\n").length;
  const lastNewline = prefix.lastIndexOf("\n");
  const column = safeIndex - lastNewline;
  return { line, column };
}

