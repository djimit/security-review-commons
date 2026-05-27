export function read(req, baseDir) {
  const relative = req.params.file;
  return path.join(baseDir, relative);
}

