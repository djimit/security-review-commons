import ejs from "ejs";

export function preview(req) {
  return ejs.render(req.body.template, { user: req.user });
}
