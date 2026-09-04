import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  buildAdminOriginUrl,
  buildCanonicalAdminUrl,
  isAdminPath,
  normalizeUnsafeOrigin,
} from "../admin-proxy.js";

test("matches only the admin path boundary", () => {
  assert.equal(isAdminPath("/admin"), true);
  assert.equal(isAdminPath("/admin/"), true);
  assert.equal(isAdminPath("/admin/users/42"), true);

  assert.equal(isAdminPath("/"), false);
  assert.equal(isAdminPath("/administrator"), false);
  assert.equal(isAdminPath("/Admin"), false);
  assert.equal(isAdminPath("/shop/admin"), false);
});

test("maps admin paths and query strings to the admin origin", () => {
  const upstreamUrl = buildAdminOriginUrl(
    "https://dannysdesigns.com/admin/users?state=active&page=2",
  );

  assert.equal(
    upstreamUrl.href,
    "https://api.dannysdesigns.com/admin/users?state=active&page=2",
  );
});

test("preserves encoded path components", () => {
  const upstreamUrl = buildAdminOriginUrl(
    "https://dannysdesigns.com/admin/search/a%2Fb?q=red%20blue",
  );

  assert.equal(
    upstreamUrl.href,
    "https://api.dannysdesigns.com/admin/search/a%2Fb?q=red%20blue",
  );
});

test("canonical admin URL removes only the trailing slash", () => {
  const canonicalUrl = buildCanonicalAdminUrl(
    "https://dannysdesigns.com/admin/?next=%2Fadmin%2Fusers",
  );

  assert.equal(
    canonicalUrl.href,
    "https://dannysdesigns.com/admin?next=%2Fadmin%2Fusers",
  );
});

test("refuses to construct an upstream URL for non-admin paths", () => {
  assert.throws(
    () => buildAdminOriginUrl("https://dannysdesigns.com/administrator"),
    RangeError,
  );
});

test("normalizes only equivalent origins on unsafe methods", () => {
  const equivalentOrigin = new Headers({
    Origin: "https://dannysdesigns.com:443",
  });
  normalizeUnsafeOrigin(equivalentOrigin, "POST");
  assert.equal(equivalentOrigin.get("origin"), "https://dannysdesigns.com");

  const hostileOrigin = new Headers({ Origin: "https://attacker.example" });
  normalizeUnsafeOrigin(hostileOrigin, "DELETE");
  assert.equal(hostileOrigin.get("origin"), "https://attacker.example");

  const originWithPath = new Headers({
    Origin: "https://dannysdesigns.com/admin",
  });
  normalizeUnsafeOrigin(originWithPath, "POST");
  assert.equal(originWithPath.get("origin"), "https://dannysdesigns.com/admin");

  const missingOrigin = new Headers();
  normalizeUnsafeOrigin(missingOrigin, "PATCH");
  assert.equal(missingOrigin.has("origin"), false);

  const safeRequestOrigin = new Headers({
    Origin: "https://dannysdesigns.com:443",
  });
  normalizeUnsafeOrigin(safeRequestOrigin, "GET");
  assert.equal(
    safeRequestOrigin.get("origin"),
    "https://dannysdesigns.com:443",
  );
});

test("proxy preserves request and response semantics", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest;
  let capturedOptions;

  globalThis.fetch = async (request, options) => {
    capturedRequest = request;
    capturedOptions = options;
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/admin/dashboard",
        "Set-Cookie": "session=abc123; Secure; HttpOnly; Path=/admin",
      },
    });
  };

  try {
    const response = await worker.fetch(
      new Request("https://dannysdesigns.com/admin/login?next=%2Fadmin", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-token",
          Cookie: "existing=value",
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://dannysdesigns.com:443",
          "X-Admin-Proxy-Secret": "client-supplied-value",
        },
        body: "username=maintainer",
      }),
      { ADMIN_PROXY_SECRET: "worker-secret" },
    );

    assert.equal(
      capturedRequest.url,
      "https://api.dannysdesigns.com/admin/login?next=%2Fadmin",
    );
    assert.equal(capturedRequest.method, "POST");
    assert.equal(await capturedRequest.text(), "username=maintainer");
    assert.equal(capturedRequest.headers.get("authorization"), "Bearer test-token");
    assert.equal(capturedRequest.headers.get("cookie"), "existing=value");
    assert.equal(
      capturedRequest.headers.get("x-admin-proxy-secret"),
      "worker-secret",
    );
    assert.equal(capturedRequest.headers.get("x-forwarded-host"), "dannysdesigns.com");
    assert.equal(capturedRequest.headers.get("x-forwarded-proto"), "https");
    assert.equal(capturedRequest.headers.get("origin"), "https://dannysdesigns.com");
    assert.equal(capturedOptions.redirect, "manual");
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/admin/dashboard");
    assert.equal(
      response.headers.get("set-cookie"),
      "session=abc123; Secure; HttpOnly; Path=/admin",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fails closed when the Worker secret is unavailable", async () => {
  const response = await worker.fetch(
    new Request("https://dannysdesigns.com/admin"),
    {},
  );

  assert.equal(response.status, 500);
});

test("redirects exact trailing-slash admin URL before proxying", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response();
  };

  try {
    const response = await worker.fetch(
      new Request("https://dannysdesigns.com/admin/?next=%2Fadmin%2Fusers"),
      {},
    );

    assert.equal(response.status, 308);
    assert.equal(
      response.headers.get("location"),
      "https://dannysdesigns.com/admin?next=%2Fadmin%2Fusers",
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("continues to proxy nested admin paths", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl;
  globalThis.fetch = async (request) => {
    capturedUrl = request.url;
    return new Response("proxied");
  };

  try {
    const response = await worker.fetch(
      new Request("https://dannysdesigns.com/admin/users/?page=2"),
      { ADMIN_PROXY_SECRET: "worker-secret" },
    );

    assert.equal(capturedUrl, "https://api.dannysdesigns.com/admin/users/?page=2");
    assert.equal(await response.text(), "proxied");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
