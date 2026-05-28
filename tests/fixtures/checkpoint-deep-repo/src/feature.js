import { routeRequest } from "../lib/router.js";

export function runTask(req) {
  return routeRequest(req.query.action);
}
