const SITE_HOST = "dannysdesigns.com";
const ADMIN_ORIGIN = "https://api.dannysdesigns.com";

export function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function buildAdminOriginUrl(requestUrl) {
  const incomingUrl = new URL(requestUrl);

  if (!isAdminPath(incomingUrl.pathname)) {
    throw new RangeError(`Not an admin path: ${incomingUrl.pathname}`);
  }

  const upstreamUrl = new URL(ADMIN_ORIGIN);
  upstreamUrl.pathname = incomingUrl.pathname;
  upstreamUrl.search = incomingUrl.search;
  return upstreamUrl;
}

export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url);

    if (incomingUrl.hostname !== SITE_HOST || !isAdminPath(incomingUrl.pathname)) {
      return new Response("Not found", { status: 404 });
    }

    const upstreamRequest = new Request(buildAdminOriginUrl(incomingUrl), request);
    upstreamRequest.headers.set("X-Forwarded-Host", incomingUrl.host);
    upstreamRequest.headers.set(
      "X-Forwarded-Proto",
      incomingUrl.protocol.slice(0, -1),
    );

    return fetch(upstreamRequest, { redirect: "manual" });
  },
};
