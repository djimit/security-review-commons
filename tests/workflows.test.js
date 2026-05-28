import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

function readWorkflow(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("CI workflow publishes the documented proof artifacts", () => {
  const ci = readWorkflow(".github/workflows/ci.yml");

  assert.match(ci, /npm run benchmark/);
  assert.match(ci, /artifacts\/sample\.sarif/);
  assert.match(ci, /artifacts\/sample-summary\.md/);
  assert.match(ci, /artifacts\/corpus-report\.md/);
  assert.match(ci, /artifacts\/benchmark-baseline\.json/);
  assert.match(ci, /artifacts\/runtime-fixtures\.json/);
  assert.match(ci, /name:\s+security-review-artifacts/);
});

test("release workflow attaches tarball plus benchmark and runtime-proof artifacts", () => {
  const release = readWorkflow(".github/workflows/release.yml");

  assert.match(release, /push:\s*\n\s*tags:\s*\n\s*-\s+"v\*"/);
  assert.match(release, /npm run check/);
  assert.match(release, /npm run benchmark/);
  assert.match(release, /npm pack/);
  assert.match(release, /release-artifacts\/benchmark-baseline\.json/);
  assert.match(release, /release-artifacts\/runtime-fixtures\.json/);
  assert.match(release, /npm publish --access public/);
  assert.match(release, /secrets\.NPM_TOKEN/);
});
