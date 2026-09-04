# Danny's Designs

The static website for [dannysdesigns.com](https://dannysdesigns.com), deployed with GitHub Pages.

## Local development

```bash
python -m http.server 4173 --directory public
```

Then open `http://localhost:4173`.

## Build and validation

```bash
python scripts/build.py
python tests/validate_site.py
```

The production-ready site is generated in `dist/`. The `/admin/` page is intentionally excluded from search indexing.

## Admin edge proxy

The Worker in `worker/` proxies only `https://dannysdesigns.com/admin` and
`https://dannysdesigns.com/admin/*` to the existing tunnel at
`https://api.dannysdesigns.com`. All other paths continue directly to GitHub
Pages because they are outside the Worker's route bindings. The proxy keeps the
HTTP method, query string, body, headers, redirect response, cookies, and status
code. Its proxy secret is stored only as a Cloudflare Worker secret.

Run the route and URL tests with:

```bash
npm test
```

### Deploy the Worker

1. In Cloudflare, confirm `dannysdesigns.com` is an active zone and its Pages
   DNS records are proxied through Cloudflare.
2. Authenticate Wrangler with `npx wrangler login`, or set a local/CI
   `CLOUDFLARE_API_TOKEN` that can edit Workers Scripts and Workers Routes for
   the zone. Do not commit the token.
3. Generate one strong random `ADMIN_PROXY_SECRET` and configure the identical
   value in the Flask server environment and the Worker. With the value already
   stored in the current user's environment, upload it without printing it:

   ```powershell
   [Environment]::GetEnvironmentVariable("ADMIN_PROXY_SECRET", "User") |
       npx wrangler secret put ADMIN_PROXY_SECRET --config worker/wrangler.toml
   ```

   Never place this value in `wrangler.toml`, source code, or GitHub Pages.
4. Run `npm ci`, then `npm run deploy:worker`.
5. In **Workers & Pages > dannys-designs-admin-proxy > Settings > Domains &
   Routes**, verify the `dannysdesigns.com/admin*` route exists. Cloudflare
   requires the wildcard for the exact `/admin` path to invoke the Worker; the
   Worker itself rejects paths outside the `/admin` boundary.
6. Request `/`, `/assets/styles.css`, and `/admin`; the first two should remain
   GitHub Pages responses, while `/admin` should return the Flask console.

The checked-in `worker/wrangler.toml` creates this narrowly scoped route during
deployment. Do not add a catch-all `dannysdesigns.com/*` route: that would put
the Worker in front of the rest of the GitHub Pages site.

The Worker sends the server-required `X-Admin-Proxy-Secret` and
`X-Forwarded-Proto: https` headers.
An exact `/admin/` request receives a same-origin `308` redirect to `/admin`
with its query string preserved; nested paths such as `/admin/users/` continue
to proxy unchanged.
For unsafe methods, the Worker sets the private
`X-Admin-Public-Origin: https://dannysdesigns.com` attestation only when the
browser sends that exact `Origin`, or when `Origin` is absent and
`Sec-Fetch-Site` is exactly `same-origin`. It removes every client-supplied
attestation first. Cross-origin, malformed, or unclassified unsafe requests
receive `403` at the edge and are never forwarded. Safe methods are forwarded
without the attestation.

### Protect the admin console with Cloudflare Access

Use Access as an additional authentication layer for both public admin entry
points:

1. In **Zero Trust > Access > Applications**, add one self-hosted application
   with public-hostname entries for `dannysdesigns.com/admin`,
   `dannysdesigns.com/admin/*`, `api.dannysdesigns.com/admin`, and
   `api.dannysdesigns.com/admin/*`. Keeping both hostnames in one application
   lets the Worker's forwarded Access token use the same application audience.
2. Add an **Allow** policy limited to the maintainer identities or identity
   provider group, with short session duration and MFA.
3. Leave `api.dannysdesigns.com/health` and every other public API path outside
   these Access applications. Do not create an application for
   `api.dannysdesigns.com/*`.

No Access credentials belong in this repository. Cloudflare enforces the
policies before requests reach the Worker or tunnel.
