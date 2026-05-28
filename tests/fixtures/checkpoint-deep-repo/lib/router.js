import { evaluateAction } from "./engine.js";

export function routeRequest(action) {
  return evaluateAction(action);
}
