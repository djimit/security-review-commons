function sanitizeRelativePath(input) {
  return input.replace(/\.\./g, "");
}

export function read(req, baseDir) {
  const relative = req.params.file;
  return path.join(baseDir, sanitizeRelativePath(relative));
}
