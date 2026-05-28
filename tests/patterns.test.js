import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runDeterministicReview } from "../src/core/review.js";

const fixturesDir = path.resolve(import.meta.dirname, "fixtures");

test("deterministic review finds built-in risky patterns", () => {
  const diff = `
    const token = "supersecret12345";
    const child = spawn(userInput, { shell: true });
  `;
  const result = runDeterministicReview({
    diff,
    changedFiles: ["src/auth/login.js"],
    layer: "turn"
  });

  assert.equal(result.findings.length, 2);
  assert.match(result.auditEvent, /"findingCount":2/);
  const secretFinding = result.findings.find(
    (finding) => finding.source.ruleId === "builtin-hardcoded-secret-token"
  );
  assert.deepEqual(secretFinding.location, {
    file: "src/auth/login.js",
    line: 2,
    column: 11
  });
});

test("custom additive pattern is applied", () => {
  const diff = `const bypassAuth = true;`;
  const result = runDeterministicReview({
    diff,
    changedFiles: ["src/auth/login.js"],
    layer: "edit",
    config: {
      customPatterns: [
        {
          id: "custom-no-bypass-auth",
          title: "Avoid bypass auth flags",
          regex: "bypassAuth",
          severity: "high",
          pathRegex: "auth"
        }
      ]
    }
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source.ruleId, "custom-no-bypass-auth");
});

test("suppressions remove only matching active findings", () => {
  const diff = `const token = "supersecret12345";`;
  const result = runDeterministicReview({
    diff,
    changedFiles: ["fixtures/demo.js"],
    layer: "turn",
    config: {
      suppressions: [
        {
          ruleId: "builtin-hardcoded-secret-token",
          pathRegex: "fixtures/",
          owner: "security-team",
          justification: "Intentional fixture pattern",
          expiresOn: "2027-01-31"
        }
      ]
    }
  });

  assert.equal(result.findings.length, 0);
  assert.equal(result.suppressedFindings.length, 1);
});

test("workflow rules catch dangerous GitHub Actions patterns", () => {
  const diff = fs.readFileSync(
    path.join(fixturesDir, "workflow-dangerous.yml"),
    "utf8"
  );
  const result = runDeterministicReview({
    diff,
    changedFiles: [".github/workflows/dangerous.yml"],
    layer: "turn"
  });

  const ruleIds = result.findings.map((finding) => finding.source.ruleId).sort();
  assert.deepEqual(ruleIds, [
    "builtin-github-actions-curl-pipe-shell",
    "builtin-github-actions-pull-request-target",
    "builtin-github-actions-write-all-permissions"
  ]);
});

test("container and infrastructure rules catch privilege and exposure drift", () => {
  const dockerResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "Dockerfile.root"), "utf8"),
    changedFiles: ["Dockerfile"],
    layer: "turn"
  });
  const k8sResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "k8s-privileged.yaml"), "utf8"),
    changedFiles: ["deploy/k8s-privileged.yaml"],
    layer: "turn"
  });
  const tfResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "public-ssh.tf"), "utf8"),
    changedFiles: ["infra/public-ssh.tf"],
    layer: "turn"
  });

  assert.equal(dockerResult.findings[0].source.ruleId, "builtin-dockerfile-missing-user");
  assert.deepEqual(
    k8sResult.findings.map((finding) => finding.source.ruleId).sort(),
    ["builtin-kubernetes-privileged-container", "builtin-kubernetes-runas-root"]
  );
  assert.equal(
    tfResult.findings[0].source.ruleId,
    "builtin-terraform-public-ssh-ingress"
  );
});

test("dependency governance rule catches catch-all selectors", () => {
  const diff = fs.readFileSync(
    path.join(fixturesDir, "package-unpinned.json"),
    "utf8"
  );
  const result = runDeterministicReview({
    diff,
    changedFiles: ["package.json"],
    layer: "turn"
  });

  assert.equal(
    result.findings[0].source.ruleId,
    "builtin-package-json-unpinned-version"
  );
});

test("web redirect and DOM HTML injection rules catch untrusted rendering patterns", () => {
  const redirectResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-open-redirect-tainted.js"),
      "utf8"
    ),
    changedFiles: ["src/open-redirect-tainted.js"],
    layer: "turn"
  });
  const htmlResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-dangerously-set-inner-html-tainted.jsx"),
      "utf8"
    ),
    changedFiles: ["src/render-danger.jsx"],
    layer: "turn"
  });

  assert.equal(
    redirectResult.findings[0].source.ruleId,
    "builtin-open-redirect-from-user-input"
  );
  assert.equal(
    htmlResult.findings[0].source.ruleId,
    "builtin-dangerously-set-inner-html-user-input"
  );
});

test("auth, idor, and template-injection rules catch untrusted application flow patterns", () => {
  const authResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-auth-bypass-tainted.js"),
      "utf8"
    ),
    changedFiles: ["src/auth-bypass-tainted.js"],
    layer: "turn"
  });
  const idorResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-idor-tainted.js"),
      "utf8"
    ),
    changedFiles: ["src/idor-tainted.js"],
    layer: "turn"
  });
  const templateResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-template-render-tainted.js"),
      "utf8"
    ),
    changedFiles: ["src/template-render-tainted.js"],
    layer: "turn"
  });

  assert.equal(
    authResult.findings[0].source.ruleId,
    "builtin-auth-bypass-flag"
  );
  assert.equal(
    idorResult.findings[0].source.ruleId,
    "builtin-idor-direct-object-reference"
  );
  assert.equal(
    templateResult.findings[0].source.ruleId,
    "builtin-template-render-user-input"
  );
});

test("expanded authz, idor helper, and template-string rules catch broader high-signal patterns", () => {
  const authzResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-authz-disabled-tainted.js"),
      "utf8"
    ),
    changedFiles: ["src/authz-disabled-tainted.js"],
    layer: "turn"
  });
  const idorHelperResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-idor-helper-tainted.js"),
      "utf8"
    ),
    changedFiles: ["src/idor-helper-tainted.js"],
    layer: "turn"
  });
  const templateStringResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-template-render-string-tainted.js"),
      "utf8"
    ),
    changedFiles: ["src/template-render-string-tainted.js"],
    layer: "turn"
  });

  assert.equal(
    authzResult.findings[0].source.ruleId,
    "builtin-authz-check-disabled"
  );
  assert.equal(
    idorHelperResult.findings[0].source.ruleId,
    "builtin-idor-direct-object-reference"
  );
  assert.equal(
    templateStringResult.findings[0].source.ruleId,
    "builtin-template-render-user-input"
  );
});

test("python unsafe deserialization rules catch pickle and torch loads", () => {
  const pickleResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "py-pickle-dangerous.py"),
      "utf8"
    ),
    changedFiles: ["src/pickle-dangerous.py"],
    layer: "turn"
  });
  const torchResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "py-torch-dangerous.py"),
      "utf8"
    ),
    changedFiles: ["src/torch-dangerous.py"],
    layer: "turn"
  });

  assert.equal(
    pickleResult.findings[0].source.ruleId,
    "builtin-python-pickle-load"
  );
  assert.equal(
    torchResult.findings[0].source.ruleId,
    "builtin-python-torch-load"
  );
});

test("python yaml and subprocess shell rules catch unsafe execution patterns", () => {
  const yamlResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "py-yaml-dangerous.py"),
      "utf8"
    ),
    changedFiles: ["src/yaml-dangerous.py"],
    layer: "turn"
  });
  const subprocessResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "py-subprocess-shell-dangerous.py"),
      "utf8"
    ),
    changedFiles: ["src/subprocess-shell-dangerous.py"],
    layer: "turn"
  });

  assert.equal(
    yamlResult.findings[0].source.ruleId,
    "builtin-unsafe-yaml-load"
  );
  assert.equal(
    subprocessResult.findings[0].source.ruleId,
    "builtin-python-subprocess-shell-true"
  );
});

test("expanded Python command-execution rules catch os and subprocess string sinks", () => {
  const osSystemResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "py-os-system-dangerous.py"),
      "utf8"
    ),
    changedFiles: ["src/os-system-dangerous.py"],
    layer: "turn"
  });
  const osPopenResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "py-os-popen-dangerous.py"),
      "utf8"
    ),
    changedFiles: ["src/os-popen-dangerous.py"],
    layer: "turn"
  });
  const subprocessOutputResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "py-subprocess-getoutput-dangerous.py"),
      "utf8"
    ),
    changedFiles: ["src/subprocess-getoutput-dangerous.py"],
    layer: "turn"
  });

  assert.equal(
    osSystemResult.findings[0].source.ruleId,
    "builtin-python-os-system"
  );
  assert.equal(
    osPopenResult.findings[0].source.ruleId,
    "builtin-python-os-popen"
  );
  assert.equal(
    subprocessOutputResult.findings[0].source.ruleId,
    "builtin-python-subprocess-output-shell"
  );
});

test("new high-signal negative fixtures remain clean", () => {
  for (const [fixture, changedFile] of [
    ["js-authz-disabled-safe.js", "src/authz-disabled-safe.js"],
    ["js-idor-helper-safe.js", "src/idor-helper-safe.js"],
    ["js-template-render-string-safe.js", "src/template-render-string-safe.js"],
    ["py-subprocess-safe.py", "src/subprocess-safe.py"]
  ]) {
    const result = runDeterministicReview({
      diff: fs.readFileSync(path.join(fixturesDir, fixture), "utf8"),
      changedFiles: [changedFile],
      layer: "turn"
    });

    assert.deepEqual(result.findings, []);
  }
});

test("safe fixtures do not trigger current drift rules", () => {
  const workflowResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "workflow-safe.yml"), "utf8"),
    changedFiles: [".github/workflows/safe.yml"],
    layer: "turn"
  });
  const dockerResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "Dockerfile.safe"), "utf8"),
    changedFiles: ["Dockerfile"],
    layer: "turn"
  });
  const packageResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "package-pinned.json"), "utf8"),
    changedFiles: ["package.json"],
    layer: "turn"
  });
  const redirectResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-open-redirect-safe.js"),
      "utf8"
    ),
    changedFiles: ["src/open-redirect-safe.js"],
    layer: "turn"
  });
  const htmlResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-dangerously-set-inner-html-safe.jsx"),
      "utf8"
    ),
    changedFiles: ["src/render-safe.jsx"],
    layer: "turn"
  });
  const pythonResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "py-safe-json.py"), "utf8"),
    changedFiles: ["src/py-safe-json.py"],
    layer: "turn"
  });
  const authResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-auth-bypass-safe.js"),
      "utf8"
    ),
    changedFiles: ["src/auth-bypass-safe.js"],
    layer: "turn"
  });
  const idorResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-idor-safe.js"),
      "utf8"
    ),
    changedFiles: ["src/idor-safe.js"],
    layer: "turn"
  });
  const templateResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-template-render-safe.js"),
      "utf8"
    ),
    changedFiles: ["src/template-render-safe.js"],
    layer: "turn"
  });
  const subprocessResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "py-subprocess-safe.py"),
      "utf8"
    ),
    changedFiles: ["src/py-subprocess-safe.py"],
    layer: "turn"
  });
  const yamlResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "py-yaml-safe.py"), "utf8"),
    changedFiles: ["src/py-yaml-safe.py"],
    layer: "turn"
  });

  assert.equal(workflowResult.findings.length, 0);
  assert.equal(dockerResult.findings.length, 0);
  assert.equal(packageResult.findings.length, 0);
  assert.equal(redirectResult.findings.length, 0);
  assert.equal(htmlResult.findings.length, 0);
  assert.equal(pythonResult.findings.length, 0);
  assert.equal(authResult.findings.length, 0);
  assert.equal(idorResult.findings.length, 0);
  assert.equal(templateResult.findings.length, 0);
  assert.equal(subprocessResult.findings.length, 0);
  assert.equal(yamlResult.findings.length, 0);
});

test("semantic JS analysis catches tainted flows into sinks", () => {
  const execResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "js-exec-tainted.js"), "utf8"),
    changedFiles: ["src/exec-tainted.js"],
    layer: "turn"
  });
  const fetchResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "js-fetch-tainted.js"), "utf8"),
    changedFiles: ["src/fetch-tainted.js"],
    layer: "turn"
  });
  const pathResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "js-path-tainted.js"), "utf8"),
    changedFiles: ["src/path-tainted.js"],
    layer: "turn"
  });
  const redirectResult = runDeterministicReview({
    diff: fs.readFileSync(
      path.join(fixturesDir, "js-open-redirect-tainted.js"),
      "utf8"
    ),
    changedFiles: ["src/open-redirect-tainted.js"],
    layer: "turn"
  });

  assert.equal(execResult.findings[0].source.ruleId, "semantic-js-exec-tainted-input");
  assert.equal(fetchResult.findings[0].source.ruleId, "semantic-js-fetch-tainted-url");
  assert.equal(pathResult.findings[0].source.ruleId, "semantic-js-path-tainted-input");
  assert.ok(
    redirectResult.findings.some(
      (finding) => finding.source.ruleId === "semantic-js-redirect-tainted-input"
    )
  );
  assert.deepEqual(execResult.findings[0].location, {
    file: "src/exec-tainted.js",
    line: 3,
    column: 10
  });
});

test("semantic JS analysis avoids clean non-request flows", () => {
  const result = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "js-safe-flow.js"), "utf8"),
    changedFiles: ["src/js-safe-flow.js"],
    layer: "turn"
  });

  assert.equal(result.findings.length, 0);
});

test("semantic analysis supports TypeScript syntax", () => {
  const execResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "ts-exec-tainted.ts"), "utf8"),
    changedFiles: ["src/ts-exec-tainted.ts"],
    layer: "turn"
  });
  const fetchResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "ts-fetch-tainted.ts"), "utf8"),
    changedFiles: ["src/ts-fetch-tainted.ts"],
    layer: "turn"
  });
  const safeResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "ts-safe-flow.ts"), "utf8"),
    changedFiles: ["src/ts-safe-flow.ts"],
    layer: "turn"
  });

  assert.equal(execResult.findings[0].source.ruleId, "semantic-js-exec-tainted-input");
  assert.equal(fetchResult.findings[0].source.ruleId, "semantic-js-fetch-tainted-url");
  assert.equal(safeResult.findings.length, 0);
});

test("semantic analysis honors explicit sink-scoped sanitizers", () => {
  const jsFetchResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "js-fetch-sanitized.js"), "utf8"),
    changedFiles: ["src/js-fetch-sanitized.js"],
    layer: "turn"
  });
  const jsPathResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "js-path-sanitized.js"), "utf8"),
    changedFiles: ["src/js-path-sanitized.js"],
    layer: "turn"
  });
  const tsFetchResult = runDeterministicReview({
    diff: fs.readFileSync(path.join(fixturesDir, "ts-fetch-sanitized.ts"), "utf8"),
    changedFiles: ["src/ts-fetch-sanitized.ts"],
    layer: "turn"
  });

  assert.equal(jsFetchResult.findings.length, 0);
  assert.equal(jsPathResult.findings.length, 0);
  assert.equal(tsFetchResult.findings.length, 0);
});
