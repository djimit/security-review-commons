import ejs from "ejs";

const trustedTemplate = "<h1><%= user.name %></h1>";

export function preview(user) {
  return ejs.render(trustedTemplate, { user });
}
