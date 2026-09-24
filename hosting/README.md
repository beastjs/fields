# Hosting Worker

One Cloudflare Worker serves every published project. Sites answer on
`{slug}.{SITES_DOMAIN}`; the Worker resolves the slug through KV to an immutable
deployment in R2. Publishing and rolling back are one KV write.

```text
hello.SITES_DOMAIN/about  →  KV route:hello = <deploymentId>
                          →  R2 deployments/<deploymentId>/about   (missing, extensionless)
                          →  R2 deployments/<deploymentId>/index.html
```

`src/app.ts` holds the logic; `src/worker.ts` is the entry, which may only export
the handler. Tests live in `../tests/hosting-worker.test.ts` and run with the root
`bun test`.

## Serving

- `GET`/`HEAD` only. Paths under `/_m/` are content-addressed modules
  (`src/playground/site-build.ts`) and cache for a year, `immutable`. Everything
  else revalidates (`max-age=0, must-revalidate`, ETag → 304).
- An extensionless path that is not a file falls back to `/index.html` (client
  routes); a missing file with an extension is a 404.
- Route lookups use a 60-second KV edge cache, so a publish, rollback or
  unpublish can take up to about a minute to reach every location.

## Admin API

Answers under `/_admin/` on any host that is **not** a site host (the workers.dev
URL in production). Every call needs `Authorization: Bearer $ADMIN_TOKEN`
(at least 32 characters). Only the Convex backend calls it.

| Method | Path | Body | Effect |
| --- | --- | --- | --- |
| `PUT` | `/_admin/deployments/:id` | `{ files: [{ path, content, contentType }] }` | Uploads and seals a deployment. `409` if already sealed. Needs `/index.html`; at most 500 files and 25 MB. |
| `GET` | `/_admin/deployments/:id` | | The deployment's manifest. |
| `DELETE` | `/_admin/deployments/:id` | | Unseals, then deletes its files. Point routes elsewhere first. |
| `GET` | `/_admin/routes/:slug` | | `{ slug, deploymentId }` |
| `PUT` | `/_admin/routes/:slug` | `{ deploymentId }` | Publishes or rolls back. `409` unless the deployment is sealed. |
| `DELETE` | `/_admin/routes/:slug` | | Unpublishes. |

Deployment ids are `[a-z0-9_-]{1,64}`; slugs are DNS labels (`[a-z0-9-]`, 1–63,
no leading or trailing hyphen).

## Local development

```sh
cp hosting/.dev.vars.example hosting/.dev.vars
bun install --cwd hosting
hosting/node_modules/.bin/wrangler dev --local --config hosting/wrangler.jsonc --port 8787
```

The `hosting` launch configuration runs the same command. With
`SITES_DOMAIN=localhost`, a slug `hello` is served at `http://hello.localhost:8787`
and the admin API at `http://127.0.0.1:8787/_admin/…`. R2 and KV are simulated
under `hosting/.wrangler/`.
