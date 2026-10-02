/**
 * www.fabraham.dev's whole job: send everyone to the bare domain.
 *
 * A 301 rather than serving a copy of the site, so search engines see one
 * host. Path and query string ride along. See wrangler.www.jsonc.
 */
export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.hostname = "fabraham.dev";
    url.port = "";
    return Response.redirect(url.toString(), 301);
  },
};
