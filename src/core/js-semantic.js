import { Parser } from "acorn";
import { tsPlugin } from "acorn-typescript";
import { makeFinding } from "./findings.js";

const JS_PATH_REGEX = /(^|\/).+\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i;
const TypeScriptParser = Parser.extend(tsPlugin());
const SANITIZER_NAMES_BY_CATEGORY = {
  "path-traversal": new Set([
    "sanitizePathSegment",
    "sanitizeRelativePath",
    "validateRelativePath",
    "assertSafeRelativePath"
  ]),
  ssrf: new Set([
    "sanitizeUrl",
    "validateUrl",
    "assertAllowedUrl"
  ])
};

const JS_SEMANTIC_RULES = [
  {
    id: "semantic-js-exec-tainted-input",
    title: "Tainted input reaches command execution",
    severity: "high",
    category: "command-injection",
    matchesSink(node) {
      return isIdentifierCall(node, ["exec", "execSync", "spawn", "spawnSync"]);
    },
    explanation:
      "A value derived from request-controlled input appears to reach command execution.",
    proposedFix:
      "Avoid shell or process execution on request-derived input; prefer allowlisted argv construction and strict validation."
  },
  {
    id: "semantic-js-eval-tainted-input",
    title: "Tainted input reaches eval-like execution",
    severity: "high",
    category: "code-injection",
    matchesSink(node) {
      return isIdentifierCall(node, ["eval", "Function"]);
    },
    explanation:
      "A value derived from request-controlled input appears to reach dynamic code execution.",
    proposedFix:
      "Remove eval-like execution or isolate it behind a strict trusted-input boundary."
  },
  {
    id: "semantic-js-fetch-tainted-url",
    title: "Tainted input reaches outbound request target",
    severity: "medium",
    category: "ssrf",
    matchesSink(node) {
      return (
        isIdentifierCall(node, ["fetch", "got", "request"]) ||
        isMemberCall(node, "axios", ["get", "post", "request"])
      );
    },
    explanation:
      "A value derived from request-controlled input appears to reach an outbound URL sink.",
    proposedFix:
      "Validate schemes, hosts, and destination allowlists before using request-derived URLs."
  },
  {
    id: "semantic-js-path-tainted-input",
    title: "Tainted input reaches filesystem path construction",
    severity: "medium",
    category: "path-traversal",
    matchesSink(node) {
      return isMemberCall(node, "path", ["join", "resolve"]);
    },
    explanation:
      "A value derived from request-controlled input appears to reach filesystem path construction.",
    proposedFix:
      "Normalize and bound the resulting path against a trusted root, or use an explicit allowlist."
  }
];

export function evaluateJsSemanticFindings({ diff, changedFiles, layer }) {
  if (!changedFiles.some((file) => JS_PATH_REGEX.test(file))) {
    return [];
  }

  const ast = tryParse(diff);
  if (!ast) {
    return [];
  }

  const taintedIdentifiers = collectTaintedIdentifiers(ast);
  if (taintedIdentifiers.size === 0) {
    return [];
  }

  const findings = [];
  visitNodes(ast, (node) => {
    if (node.type !== "CallExpression") {
      return;
    }

    for (const rule of JS_SEMANTIC_RULES) {
      if (!rule.matchesSink(node)) {
        continue;
      }
      if (
        !node.arguments.some((argument) =>
          expressionNeedsFinding(argument, taintedIdentifiers, rule.category)
        )
      ) {
        continue;
      }

      findings.push(
        makeFinding({
          title: rule.title,
          severity: rule.severity,
          confidence: "high",
          category: rule.category,
          files: changedFiles,
          explanation: rule.explanation,
          proposedFix: rule.proposedFix,
          location: {
            file: changedFiles[0],
            line: node.loc.start.line,
            column: node.loc.start.column + 1
          },
          source: { ruleId: rule.id, layer }
        })
      );
    }
  });

  return findings;
}

function tryParse(diff) {
  try {
    return TypeScriptParser.parse(diff, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true
    });
  } catch {
    return null;
  }
}

function collectTaintedIdentifiers(ast) {
  const tainted = new Set();

  for (let pass = 0; pass < 4; pass += 1) {
    visitNodes(ast, (node) => {
      if (
        node.type === "VariableDeclarator" &&
        node.id?.type === "Identifier" &&
        node.init &&
        expressionIsTainted(node.init, tainted)
      ) {
        tainted.add(node.id.name);
      }
      if (
        node.type === "AssignmentExpression" &&
        node.left?.type === "Identifier" &&
        expressionIsTainted(node.right, tainted)
      ) {
        tainted.add(node.left.name);
      }
    });
  }

  return tainted;
}

function expressionIsTainted(node, taintedIdentifiers) {
  if (!node) {
    return false;
  }

  switch (node.type) {
    case "Identifier":
      return taintedIdentifiers.has(node.name);
    case "MemberExpression":
      return memberExpressionIsTaintSource(node) || expressionIsTainted(node.object, taintedIdentifiers);
    case "CallExpression":
      return (
        expressionIsTainted(node.callee, taintedIdentifiers) ||
        node.arguments.some((argument) => expressionIsTainted(argument, taintedIdentifiers))
      );
    case "TemplateLiteral":
      return node.expressions.some((expression) => expressionIsTainted(expression, taintedIdentifiers));
    case "BinaryExpression":
    case "LogicalExpression":
      return (
        expressionIsTainted(node.left, taintedIdentifiers) ||
        expressionIsTainted(node.right, taintedIdentifiers)
      );
    case "ConditionalExpression":
      return (
        expressionIsTainted(node.test, taintedIdentifiers) ||
        expressionIsTainted(node.consequent, taintedIdentifiers) ||
        expressionIsTainted(node.alternate, taintedIdentifiers)
      );
    case "ArrayExpression":
      return node.elements.some((element) => expressionIsTainted(element, taintedIdentifiers));
    case "ObjectExpression":
      return node.properties.some((property) =>
        property.type === "Property"
          ? expressionIsTainted(property.value, taintedIdentifiers)
          : false
      );
    case "ChainExpression":
      return expressionIsTainted(node.expression, taintedIdentifiers);
    case "AwaitExpression":
    case "UnaryExpression":
      return expressionIsTainted(node.argument, taintedIdentifiers);
    default:
      return false;
  }
}

function expressionNeedsFinding(node, taintedIdentifiers, category) {
  return (
    expressionIsTainted(node, taintedIdentifiers) &&
    !expressionIsRecognizedSanitizerCall(node, taintedIdentifiers, category)
  );
}

function expressionIsRecognizedSanitizerCall(node, taintedIdentifiers, category) {
  if (node?.type !== "CallExpression") {
    return false;
  }

  const sanitizerNames = SANITIZER_NAMES_BY_CATEGORY[category];
  if (!sanitizerNames || !calleeMatchesNames(node.callee, sanitizerNames)) {
    return false;
  }

  return node.arguments.some((argument) => expressionIsTainted(argument, taintedIdentifiers));
}

function memberExpressionIsTaintSource(node) {
  const parts = flattenMemberExpression(node);
  if (parts.length < 2) {
    return false;
  }

  const patterns = [
    ["req", "body"],
    ["req", "query"],
    ["req", "params"],
    ["request", "body"],
    ["request", "query"],
    ["request", "params"],
    ["ctx", "request", "body"],
    ["ctx", "request", "query"],
    ["ctx", "request", "params"]
  ];

  return patterns.some((pattern) => pattern.every((segment, index) => parts[index] === segment));
}

function flattenMemberExpression(node) {
  if (node.type === "Identifier") {
    return [node.name];
  }
  if (node.type !== "MemberExpression" || node.computed) {
    return [];
  }
  return [
    ...flattenMemberExpression(node.object),
    propertyName(node.property)
  ].filter(Boolean);
}

function propertyName(node) {
  return node?.type === "Identifier" ? node.name : null;
}

function isIdentifierCall(node, identifiers) {
  return (
    node.callee?.type === "Identifier" && identifiers.includes(node.callee.name)
  );
}

function isMemberCall(node, objectName, propertyNames) {
  return (
    node.callee?.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.object?.type === "Identifier" &&
    node.callee.object.name === objectName &&
    node.callee.property?.type === "Identifier" &&
    propertyNames.includes(node.callee.property.name)
  );
}

function calleeMatchesNames(node, names) {
  if (node?.type === "Identifier") {
    return names.has(node.name);
  }

  return (
    node?.type === "MemberExpression" &&
    !node.computed &&
    node.property?.type === "Identifier" &&
    names.has(node.property.name)
  );
}

function visitNodes(node, visitor) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (typeof node.type === "string") {
    visitor(node);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        visitNodes(entry, visitor);
      }
    } else if (value && typeof value === "object") {
      visitNodes(value, visitor);
    }
  }
}
