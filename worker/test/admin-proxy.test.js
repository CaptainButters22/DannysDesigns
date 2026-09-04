import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  attestUnsafeRequest,
  buildAdminOriginUrl,
  buildCanonicalAdminUrl,
  isAdminPath,
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

test("attests an unsafe request with an exact public Origin", () => {
  const headers = new Headers({
    Origin: "https://dannysdesigns.com",
    "X-Admin-Public-Origin": "https://attacker.example",
  });

  assert.equal(attestUnsafeRequest(headers, "POST"), true);
  assert.equal(
    headers.get("x-admin-public-origin"),
    "https://dannysdesigns.com",
  );
});

test("attests embedded browser requests with unavailable Origin metadata", () => {
  for (const headers of [
    new Headers(),
    new Headers({ Origin: "null" }),
    new Headers({ Origin: "app://admin-shell" }),
    new Headers({
      "Sec-Fetch-Site": "none",
      "X-Admin-Public-Origin": "https://attacker.example",
    }),
  ]) {
    assert.equal(attestUnsafeRequest(headers, "PATCH"), true);
    assert.equal(
      headers.get("x-admin-public-origin"),
      "https://dannysdesigns.com",
    );
  }
});

test("rejects explicit cross-origin HTTP and HTTPS origins", () => {
  for (const origin of [
    "http://dannysdesigns.com",
    "https://attacker.example",
    "https://dannysdesigns.com.evil.example",
  ]) {
    const headers = new Headers({
      Origin: origin,
      "X-Admin-Public-Origin": "https://dannysdesigns.com",
    });

    assert.equal(attestUnsafeRequest(headers, "DELETE"), false);
    assert.equal(headers.has("x-admin-public-origin"), false);
  }
});

test("removes client attestation from safe methods", () => {
  const headers = new Headers({
    "X-Admin-Public-Origin": "https://dannysdesigns.com",
  });

  assert.equal(attestUnsafeRequest(headers, "GET"), true);
  assert.equal(headers.has("x-admin-public-origin"), false);
});

test("rejects a non-exact HTTP origin value", () => {
  const headers = new Headers({
    Origin: "https://dannysdesigns.com:443",
  });

  assert.equal(attestUnsafeRequest(headers, "POST"), false);
  assert.equal(headers.has("x-admin-public-origin"), false);
  assert.equal(
    headers.get("origin"),
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
          Origin: "https://dannysdesigns.com",
          "X-Admin-Public-Origin": "https://attacker.example",
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
    assert.equal(capturedRequest.headers.has("x-forwarded-host"), false);
    assert.equal(capturedRequest.headers.get("x-forwarded-proto"), "https");
    assert.equal(capturedRequest.headers.get("origin"), "https://dannysdesigns.com");
    assert.equal(
      capturedRequest.headers.get("x-admin-public-origin"),
      "https://dannysdesigns.com",
    );
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

test("preserves multiple Set-Cookie headers across a manual redirect", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest;

  globalThis.fetch = async (request) => {
    capturedRequest = request;
    const headers = new Headers({ Location: "/admin/dashboard" });
    headers.append(
      "Set-Cookie",
      "website_data_session=signed-value; Secure; HttpOnly; Path=/; SameSite=Lax",
    );
    headers.append(
      "Set-Cookie",
      "admin_preference=compact; Secure; Path=/admin; SameSite=Lax",
    );
    return new Response(null, { status: 302, headers });
  };

  try {
    const response = await worker.fetch(
      new Request("https://dannysdesigns.com/admin", {
        method: "POST",
        headers: {
          Cookie: "csrf_session=existing",
          Origin: "https://dannysdesigns.com",
        },
        body: "csrf_token=test-token",
      }),
      { ADMIN_PROXY_SECRET: "worker-secret" },
    );

    assert.equal(capturedRequest.headers.get("cookie"), "csrf_session=existing");
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/admin/dashboard");
    assert.deepEqual(response.headers.getSetCookie(), [
      "website_data_session=signed-value; Secure; HttpOnly; Path=/; SameSite=Lax",
      "admin_preference=compact; Secure; Path=/admin; SameSite=Lax",
    ]);
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
  let capturedRequest;
  globalThis.fetch = async (request) => {
    capturedRequest = request;
    return new Response("proxied");
  };

  try {
    const response = await worker.fetch(
      new Request("https://dannysdesigns.com/admin/users/?page=2", {
        headers: {
          "X-Admin-Public-Origin": "https://dannysdesigns.com",
        },
      }),
      { ADMIN_PROXY_SECRET: "worker-secret" },
    );

    assert.equal(
      capturedRequest.url,
      "https://api.dannysdesigns.com/admin/users/?page=2",
    );
    assert.equal(
      capturedRequest.headers.has("x-admin-public-origin"),
      false,
    );
    assert.equal(await response.text(), "proxied");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects an unsafe request before it reaches the origin", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response();
  };

  try {
    const response = await worker.fetch(
      new Request("https://dannysdesigns.com/admin/login", {
        method: "POST",
        headers: {
          Origin: "https://attacker.example",
          "X-Admin-Public-Origin": "https://dannysdesigns.com",
        },
        body: "username=attacker",
      }),
      { ADMIN_PROXY_SECRET: "worker-secret" },
    );

    assert.equal(response.status, 403);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("forwards an embedded browser POST with attestation intact", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest;
  globalThis.fetch = async (request) => {
    capturedRequest = request;
    return new Response("invalid credentials", { status: 200 });
  };

  try {
    const response = await worker.fetch(
      new Request("https://dannysdesigns.com/admin", {
        method: "POST",
        headers: {
          Cookie: "website_data_session=signed-value",
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "null",
          "X-Admin-Public-Origin": "https://attacker.example",
        },
        body: "csrf_token=valid&password=wrong&code=0000",
      }),
      { ADMIN_PROXY_SECRET: "worker-secret" },
    );

    assert.equal(
      capturedRequest.headers.get("cookie"),
      "website_data_session=signed-value",
    );
    assert.equal(
      capturedRequest.headers.get("x-admin-public-origin"),
      "https://dannysdesigns.com",
    );
    assert.equal(
      await capturedRequest.text(),
      "csrf_token=valid&password=wrong&code=0000",
    );
    assert.equal(response.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
