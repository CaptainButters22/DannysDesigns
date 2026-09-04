import assert from "node:assert/strict";
import test from "node:test";

import worker, { buildAdminOriginUrl, isAdminPath } from "../admin-proxy.js";

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

test("refuses to construct an upstream URL for non-admin paths", () => {
  assert.throws(
    () => buildAdminOriginUrl("https://dannysdesigns.com/administrator"),
    RangeError,
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
        },
        body: "username=maintainer",
      }),
    );

    assert.equal(
      capturedRequest.url,
      "https://api.dannysdesigns.com/admin/login?next=%2Fadmin",
    );
    assert.equal(capturedRequest.method, "POST");
    assert.equal(await capturedRequest.text(), "username=maintainer");
    assert.equal(capturedRequest.headers.get("authorization"), "Bearer test-token");
    assert.equal(capturedRequest.headers.get("cookie"), "existing=value");
    assert.equal(capturedRequest.headers.get("x-forwarded-host"), "dannysdesigns.com");
    assert.equal(capturedRequest.headers.get("x-forwarded-proto"), "https");
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
