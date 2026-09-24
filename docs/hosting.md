# Project hosting

Published projects are static sites served by one Cloudflare Worker at
`https://{slug}.bigticket.ph`. Convex decides what is live; the Worker only serves.

```text
Editor ─ Publish ─► compile (site target, own worker) ─► buildSite() ─► Convex publishing:publish
                                                                            │  upload (admin API)
                                                                            ▼
visitor ─► {slug}.bigticket.ph ─► Worker ─► KV route:{slug} ─► R2 deployments/{id}/…
```

| Piece | Where |
| --- | --- |
| Site build (`site` target, import map, content-hashed modules) | `src/playground/site-build.ts`, `src/playground/publish-site.ts` |
| Hosting Worker and admin API | `hosting/` ([README](../hosting/README.md)) |
| Sites, deployments, slug rules | `convex/sites.ts`, `convex/siteSlugs.ts` |
| Publish, rollback, unpublish, route sync, retention | `convex/publishing.ts`, `convex/deploymentRetention.ts` |
| Rate limits, hourly sweep | `convex/rateLimits.ts`, `convex/crons.ts` |
| Publish dialog | `src/components/shell/PublishDialog.btsx` |

## Behaviour

- **Source of truth.** Every publish, rollback and unpublish commits in Convex and, in
  the same transaction, schedules `syncRoute`, which makes the Worker's KV route match.
  It is idempotent and retries (5 s, 30 s, 2 min, 10 min) while the Worker is unreachable.
- **Propagation.** KV is cached at each edge for up to 60 s, so a change can take about
  a minute to reach every location. Pages revalidate on every load; modules are
  content-addressed and cached for a year.
- **Addresses.** 3–48 of `[a-z0-9-]`, no `xn--`, about 50 reserved names. One per
  project; a live site must be unpublished before it is renamed.
- **Limits.** 500 files, 1 MB per file, 8 MB per site. Per user: 10 publishes or address
  changes in a burst, then about one every two minutes (30 an hour).
- **Retention.** After each publish a project keeps its live deployment and the 10 most
  recent other ready ones; older ones, and failed uploads over an hour old, are retired.
  Retiring sets `deleting` (not restorable, not routable) before the files are removed.
  The hourly sweep fails uploads stuck for 2 minutes, retires failed uploads older than a
  day, and retries unfinished removals.
- **Permissions.** Any member of the project's team can publish, restore and unpublish.

## Operating it

Each Convex deployment has its own Worker, storage and admin token, so a slug claimed in
dev can never take over a production address.

| | Production | Dev |
| --- | --- | --- |
| Convex deployment | `clean-pony-320` | `original-monitor-611` |
| Worker | `play-hosting` | `play-hosting-dev` (`wrangler … --env dev`) |
| R2 bucket / KV | `play-sites` / `ROUTES` | `play-sites-dev` / `ROUTES_DEV` |
| Sites served at | `https://{slug}.bigticket.ph` | nowhere public (`sites.invalid`) |

```sh
hosting/node_modules/.bin/wrangler deploy --config hosting/wrangler.jsonc             # production
hosting/node_modules/.bin/wrangler deploy --config hosting/wrangler.jsonc --env dev   # dev
printf '%s' "$TOKEN" | hosting/node_modules/.bin/wrangler secret put ADMIN_TOKEN --config hosting/wrangler.jsonc [--env dev]
```

DNS: a proxied `*` record on `bigticket.ph`; the route `*.bigticket.ph/*` in
`hosting/wrangler.jsonc` (production only). The apex and unproxied records (such as
`www`) are untouched.

Convex environment variables, per deployment (dev leaves `HOSTING_SITE_URL` unset):

| Variable | Production value |
| --- | --- |
| `HOSTING_SITE_URL` | `https://{slug}.bigticket.ph` |
| `HOSTING_ADMIN_URL` | `https://play-hosting.beastjs.workers.dev` (dev: `play-hosting-dev`) |
| `HOSTING_ADMIN_TOKEN` | That Worker's `ADMIN_TOKEN`; dev and production differ |
| `FIREBASE_PROJECT_ID` | Sign-in; the same Firebase project in both |

Retire one deployment by hand (refuses the live one):

```sh
npx convex run publishing:retireDeployment '{"deploymentId":"…"}'
```

## The editor

The editor itself is the `play-editor` Worker at `https://bigticket.ph` (`editor-host/`):
the production build in `dist/` as static assets, with unknown paths falling back to the
app shell, and the chat routes `/api/ai/*` and `/api/jev/*` (`server/`) run in the Worker.

```sh
cd editor-host && bun run deploy   # builds against production Convex, then deploys
```

Its chat routes use the Worker secrets `COHERE_API_KEY` and `TYPESAFE_API_KEY`. They only
refuse browsers on other origins, so anyone who can reach the editor, or script it, spends
those keys; remove the secrets to make visitors bring their own. Sign-in needs
`bigticket.ph` in Firebase Auth's authorized domains.

Editor and sites share the registrable domain `bigticket.ph`. That is a deliberate
shortcut for this pathfinder: published sites are same-site with the editor (shared
cookie scope, no SameSite separation, no Public Suffix List option), and they appear under
the editor's brand. A product for real users should put sites on a separate domain.

## Open decisions

### Public Suffix List

Until `bigticket.ph` is on the [Public Suffix List](https://publicsuffix.org/), browsers
treat every `*.bigticket.ph` site as the same site: one published site can set cookies
that every other published site receives. Listing it makes each subdomain its own site.

To apply: open a pull request adding `bigticket.ph` to the private section of
[publicsuffix/list](https://github.com/publicsuffix/list), and publish a TXT record at
`_psl.bigticket.ph` containing that pull request's URL. The domain needs at least two
years of registration remaining. Review can take weeks, and browsers pick up the list
with their releases. Once listed, nothing can share cookies across subdomains, including
anything the business later hosts under `bigticket.ph`.

### Custom domains per site

Cloudflare for SaaS (Custom Hostnames) on the `bigticket.ph` zone: a customer points
`www.theirdomain.com` at a fallback origin such as `origin.bigticket.ph`, Cloudflare
issues the certificate, and the Worker maps the hostname to a slug through KV. It needs
a Worker route that catches custom hostnames, a Cloudflare API token that Convex can use
to create hostnames, and a verification flow in the dialog. The first 100 hostnames are
included; more are billed per hostname.

### Faster route changes

If a minute of propagation is too slow, move routes from KV to a Durable Object, which
is consistent everywhere as soon as it is written.
