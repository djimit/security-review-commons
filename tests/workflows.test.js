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

  assert.match(ci, /actions\/checkout@v5/);
  assert.match(ci, /actions\/setup-node@v5/);
  assert.match(ci, /npm run benchmark/);
  assert.match(ci, /artifacts\/sample\.sarif/);
  assert.match(ci, /artifacts\/sample-summary\.md/);
  assert.match(ci, /artifacts\/corpus-report\.md/);
  assert.match(ci, /artifacts\/benchmark-baseline\.json/);
  assert.match(ci, /artifacts\/runtime-fixtures\.json/);
  assert.match(ci, /name:\s+security-review-artifacts/);
});

test("release workflow attaches tarball plus benchmark comparator and runtime-proof artifacts", () => {
  const release = readWorkflow(".github/workflows/release.yml");

  assert.match(release, /actions\/checkout@v5/);
  assert.match(release, /actions\/setup-node@v5/);
  assert.match(release, /softprops\/action-gh-release@v3/);
  assert.match(release, /push:\s*\n\s*tags:\s*\n\s*-\s+"v\*"/);
  assert.match(release, /npm run check/);
  assert.match(release, /npm run benchmark/);
  assert.match(release, /npm pack/);
  assert.match(release, /release-artifacts\/benchmark-baseline\.json/);
  assert.match(release, /release-artifacts\/external-baseline\.json/);
  assert.match(release, /release-artifacts\/runtime-fixtures\.json/);
  assert.doesNotMatch(release, /npm publish --access public/);
});

test("npm publication requires explicit workflow dispatch confirmation", () => {
  const publish = readWorkflow(".github/workflows/publish-npm.yml");

  assert.match(publish, /actions\/checkout@v5/);
  assert.match(publish, /actions\/setup-node@v5/);
  assert.match(publish, /workflow_dispatch/);
  assert.match(publish, /confirm_publish/);
  assert.match(publish, /release_tag/);
  assert.match(publish, /npm run check/);
  assert.match(publish, /npm publish --access public/);
  assert.match(publish, /secrets\.NPM_TOKEN/);
});
