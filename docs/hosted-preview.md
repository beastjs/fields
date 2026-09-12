# Optional hosted preview

Milestone 12 implements a static hosted transport alongside the default local
`srcdoc` preview. The compilers still run in the editor's worker; generated
modules and source maps reach the iframe by structured clone after its handshake.
The supplied bootstrap does not upload or persist builds. The configured endpoint
is trusted code and must be controlled by the deployment operator.

## Build and enable

`bun run build` generates `dist/preview.html` from
`src/playground/preview-bootstrap.ts`. Deploy that single file to a dedicated,
cookie-free HTTPS **separate site**, then build the editor with its exact URL:

```sh
PLAYGROUND_PREVIEW_URL=https://your-preview-site.example/preview.html bun run build
```

This is build configuration, not a runtime query parameter or shared-project
setting. Without it, the editor offers only Local preview. When configured, the
Preview mode selector offers Local preview and Hosted preview. Local remains the
default on page load. Changing mode reloads the app, keeps source and editor undo,
and retains theme, zoom, and viewport settings. The mode lasts for the current
session, including project replacement; it is excluded from saved/shared projects.

The URL must be absolute HTTPS, with no credentials, query parameters, or fragment.
HTTP is permitted only on loopback for development. URL validation does not infer
registrable domains: the operator must choose a separate site. Subdomains of the
editor's registrable domain or another port alone do not satisfy this requirement.

Serve the file without authentication, cookies, analytics, injected scripts, or
redirects. An iframe navigation can send existing destination cookies, so use a
fresh dedicated site that holds no credentials. Keep the generated CSP intact.
Suggested response headers are:

```text
Content-Type: text/html; charset=utf-8
Cache-Control: no-store
Referrer-Policy: no-referrer
Origin-Agent-Cluster: ?1
```

If adding a response CSP, preserve the document's script/style/Blob allowances.
A `frame-ancestors` header may restrict embedding to the editor origin. Do not
send `X-Frame-Options: SAMEORIGIN` or a policy that blocks the intended editor.
No CORS access is required. Project data and document channels are never added to
the endpoint URL; the iframe also suppresses its navigation referrer.

## Transport and recovery

Both transports share one bootstrap, CSP, ESM loader, console limits, HMR adapter,
and source-map protocol. Hosted pages initially contain no project or channel.
After iframe load, the parent sends a version-1 `connect` envelope with a fresh
channel, build number, and theme. The static page accepts one valid parent
connection, then sends `ready`; only then does the host transfer modules. The host
checks the source window, opaque `null` origin, channel, and build. A matching
origin alone is insufficient. Duplicate readiness, expired startup replies,
obsolete builds, and previous project/document messages are rejected.

The iframe retains `sandbox="allow-scripts"`, without `allow-same-origin`. Its
CSP blocks network fetches and forms. Consecutive compatible HMR updates reuse the
document; explicit reload, unsupported edits, project replacement, and mode changes
create a new channel and document. A 10-second startup failure leaves source intact
and offers reload or an explicit Local preview selection. There is no automatic
fallback. Retrying also clears the prior preview failure indicator.

Hosted mode displays its browser-dependent limits. This is improved failure
containment in supporting configurations, **not CPU or memory quotas**. A busy
iframe may still block the editor and its timeout. See the
[resource-isolation evaluation](preview-resource-isolation.md).

## Verification

```sh
bun run check
bun run test:browser
bun run test:browser:hosted
bun run probe:isolation
```

Run browser commands sequentially because each owns port 3100 and the production
output. The hosted suite builds the editor with
`http://localhost:3100/preview.html`, served from the same local server as the
`127.0.0.1` editor but on a different site. It covers rendering/imports, styles,
console, consecutive HMR, theme, source navigation, reload, project replacement,
editor undo, explicit fallback/retry, mobile/fullscreen, and handshake/sandbox
rejection across Chromium, Firefox, and WebKit.

The bounded responsiveness probe serves the generated `public/preview.html` for
its URL modes and performs the same handshake. It checks that the median of three
separate-site host callbacks runs before half of the finite 600 ms workload in
explicit Chromium site-isolation and Firefox Fission profiles. Default profiles
remain observational; their blocking behavior is documented. This local result
is not deployment verification. No production endpoint has been selected or
published; repeat the probe against that deployment before making containment
claims about it.

### Milestone 12 loopback measurements

The final probe completed all 60 samples with the browser suites stopped. Median
host callback times for the separate-site hosted document (nominally 100 ms,
during a finite 600 ms workload) were:

| Browser profile | Hosted callback median |
| --- | ---: |
| chromium | 600.7 ms |
| firefox | 600.0 ms |
| webkit | 600.0 ms |
| chromium-site-per-process | 101.5 ms |
| firefox-fission | 101.0 ms |

Both explicit isolation profiles passed the responsiveness check; default profiles
still blocked. These are local observations, not quotas or a production-deployment
claim. [Raw measurements](hosted-preview-isolation-results.json) retain all modes,
repetitions, browser versions, and launch settings.
