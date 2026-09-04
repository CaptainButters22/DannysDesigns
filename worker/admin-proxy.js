const SITE_HOST = "dannysdesigns.com";
const SITE_ORIGIN = `https://${SITE_HOST}`;
const ADMIN_ORIGIN = "https://api.dannysdesigns.com";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

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

export function buildCanonicalAdminUrl(requestUrl) {
  const canonicalUrl = new URL(requestUrl);
  canonicalUrl.pathname = "/admin";
  return canonicalUrl;
}

export function attestUnsafeRequest(headers, method) {
  headers.delete("X-Admin-Public-Origin");

  if (SAFE_METHODS.has(method.toUpperCase())) {
    return true;
  }

  const origin = headers.get("Origin");
  if (origin && origin !== SITE_ORIGIN) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol === "http:" || parsedOrigin.protocol === "https:") {
        return false;
      }
    } catch {
      // Embedded browsers may provide unavailable or non-standard origin metadata.
    }
  }

  headers.set("X-Admin-Public-Origin", SITE_ORIGIN);
  return true;
}

export default {
  async fetch(request, env) {
    const incomingUrl = new URL(request.url);

    if (incomingUrl.hostname !== SITE_HOST || !isAdminPath(incomingUrl.pathname)) {
      return new Response("Not found", { status: 404 });
    }

    if (incomingUrl.pathname === "/admin/") {
      return Response.redirect(buildCanonicalAdminUrl(incomingUrl), 308);
    }

    if (!env?.ADMIN_PROXY_SECRET) {
      return new Response("Admin proxy is not configured", { status: 500 });
    }

    const upstreamRequest = new Request(buildAdminOriginUrl(incomingUrl), request);
    upstreamRequest.headers.set(
      "X-Admin-Proxy-Secret",
      env.ADMIN_PROXY_SECRET,
    );
    upstreamRequest.headers.set("X-Forwarded-Proto", "https");
    if (!attestUnsafeRequest(upstreamRequest.headers, request.method)) {
      return new Response("Forbidden", { status: 403 });
    }

    return fetch(upstreamRequest, { redirect: "manual" });
  },
};
