function typeMatches(value, expected) {
  if (expected === "null") return value === null;
  if (expected === "array") return Array.isArray(value);
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "object") return typeof value === "object" && value !== null && !Array.isArray(value);
  return typeof value === expected;
}

function validateNode(schema, value, pointer = "$") {
  const errors = [];
  if (value === undefined) return errors;
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some((t) => typeMatches(value, t))) {
      errors.push({ instancePath: pointer, message: `must be type ${allowed.join("|")}` });
      return errors;
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({ instancePath: pointer, message: `must be one of ${schema.enum.join(",")}` });
  }

  if (schema.minimum !== undefined && Number.isFinite(value) && value < schema.minimum) {
    errors.push({ instancePath: pointer, message: `must be >= ${schema.minimum}` });
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((entry, idx) => errors.push(...validateNode(schema.items, entry, `${pointer}/${idx}`)));
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    if (Array.isArray(schema.required)) {
      schema.required.forEach((key) => {
        if (!(key in value)) errors.push({ instancePath: pointer, message: `must include required property ${key}` });
      });
    }
    if (schema.additionalProperties === false && schema.properties) {
      Object.keys(value).forEach((key) => {
        if (!(key in schema.properties)) errors.push({ instancePath: `${pointer}/${key}`, message: "must NOT have additional properties" });
      });
    }
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, child]) => {
        if (key in value) errors.push(...validateNode(child, value[key], `${pointer}/${key}`));
      });
    }
  }

  return errors;
}

export function validateJsonSchema(schema, value) {
  const errors = validateNode(schema, value);
  return { valid: errors.length === 0, errors };
}
