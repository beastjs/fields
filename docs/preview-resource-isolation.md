# Preview resource isolation evaluation

Evaluated 2026-09-12 (Asia/Manila). Status: evaluation complete; stronger production
isolation is not implemented by this ticket.

## Decision

Keep the current sandbox contract. The next incremental implementation should be
an **opt-in preview document hosted on a separate site**, with the current local
`srcdoc` mode as the fallback. Describe this as improved failure containment on
supporting browser configurations, not as CPU or memory quotas. A hostname under
the editor's registrable domain, or a different port alone, is not the same as a
separate site. Chromium documents the distinction between a site and an origin.
[Chromium Site Isolation](https://www.chromium.org/Home/chromium-security/site-isolation/)

If the product requires reliably stopping arbitrary DOM code and limiting its
memory regardless of the user's browser, use a **separately supervised browser
service** with OS resource controls. That is a larger architecture change, with
source transfer, session infrastructure, remote input/rendering, and operating
costs. It is not justified as a silent replacement for this local playground.

A worker is suitable for compilation and pure computation. It cannot directly
execute the existing DOM renderer: workers cannot directly manipulate the page's
DOM. Moving the preview there requires a new rendering bridge and changes to DOM,
event, layout, focus, and HMR semantics. Worker termination is available, but is
not a per-worker memory budget. [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers),
[Worker termination](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate)

## What the repository currently guarantees

- `src/playground/coordinator.ts` terminates a compiler worker after 15 seconds,
  cancels stale work, and rejects oversized projects before posting them.
- `src/playground/preview.ts` creates an opaque-origin `allow-scripts` iframe,
  validates message envelopes, restricts network through CSP, and bounds console
  forwarding. The host retains only the latest 200 console entries.
- Its 10-second startup timeout is a host timer. It is **not a preemption
  mechanism**: a busy preview can prevent that timer, editor events, and a future
  Stop button from running when they share execution resources.
- Reloading or removing an iframe is a document lifecycle operation. It does not
  give the application an OS process handle or a hard per-preview heap limit.
- Local-storage limits, compiler input limits, HMR reloads, and message limits
  reduce retained work. They do not limit arbitrary allocations in user code.

These statements come from the current code and the bounded experiment below;
no production compiler, runtime, preview transport, or deployment was changed.

## Reproducible experiment

Run from the repository root:

```sh
bun run probe:isolation
```

The command uses installed Playwright browsers and writes
`test-results/preview-isolation.json`. A checked-in snapshot accompanies this
report in [preview-isolation-results.json](preview-isolation-results.json).

The probe compiles the actual Hello World project through the installed Beast
and Octane compilers, adding a **finite 600 ms** CPU loop triggered by a message.
Every iframe uses the production `previewDocument` bootstrap, sandbox, CSP, Blob
modules, and load envelope. An ephemeral server bound to `127.0.0.1` serves the
same document for the hosted cases. The cross-site case uses `localhost` as its
URL host; it is still loopback traffic, with no source sent to an external host.

For each mode, the host samples a 20 ms timer and schedules a callback for 100 ms
after starting work. That callback approximates the opportunity for a watchdog or
Stop handler to run; **it does not attempt to stop the iframe**. Three fresh pages
are sampled per mode and browser profile. The worker comparison uses a finite
2-second loop and issues `terminate()` 100 ms after the worker reports starting.
Its result records termination being issued and whether completion was received
before then; it does not measure an OS thread exit time.

There are no infinite loops, allocation bombs, production URLs, or changes to the
user's installed browser preferences. A Bun-side 30-second watchdog closes each
probe browser on a stalled profile. Missing browsers or incomplete profiles mark
the report failed and cause a nonzero exit. Performance numbers are observations,
not CI thresholds.

The profiles are headless Playwright defaults plus two explicit diagnostic
controls: Chromium with `--site-per-process`, and Firefox with
`fission.autostart=true` / `fission.webContentIsolationStrategy=1`. These controls
apply only to the fresh probe browser. A normal website cannot set those options.
Chromium's CDP iframe-target count is sampled while the frame is still mounted;
it is supporting evidence of an out-of-process target, not a memory quota or a
complete process inventory. No equivalent process assertion is made for Firefox
or WebKit.

## Measurements

The table below is generated from the checked-in snapshot. Each number is the
median time in milliseconds at which the host's nominal 100 ms callback ran.
Approximately 600 ms indicates that the callback waited for the workload;
approximately 100 ms indicates that it ran while the workload was active (or,
for workers, around the termination request).

| Profile (browser version) | `srcdoc` | Same-origin URL | Cross-site URL | Worker termination |
| --- | ---: | ---: | ---: | ---: |
| chromium (153.0.8010.12) | 600.7 | 600.7 | 600.6 | 101.1 |
| firefox (155.0) | 600.0 | 600.0 | 601.0 | 103.0 |
| webkit (26.6) | 600.0 | 601.0 | 600.0 | 101.0 |
| chromium-site-per-process (153.0.8010.12) | 100.5 | 100.4 | 100.9 | 101.5 |
| firefox-fission (155.0) | 599.0 | 601.0 | 101.0 | 101.0 |

The workload completed normally in every iframe sample. Workers did not send
completion before termination was issued. These are finite-loop results on one
macOS machine, not memory-exhaustion tests or guarantees for all hardware.

**Interpretation:** the current `srcdoc` preview blocks the host in the default
probe profiles. Enabling Chromium site isolation keeps the host responsive even
for the opaque sandboxed `srcdoc` frame. With Firefox Fission explicitly enabled,
only the cross-site iframe keeps the host responsive. This supports a separate
site as a useful optional transport, while ruling out a universal guarantee from
an iframe URL change alone. Playwright builds and launch defaults are not a claim
about the defaults of branded Chrome, Firefox, Safari, or mobile browsers.

## Alternatives and tradeoffs

| Approach | Existing Octane DOM output | What it offers | What it does not establish |
| --- | --- | --- | --- |
| Current opaque `srcdoc` | Preserved | Local execution, data boundary, minimal setup | Host responsiveness or resource quotas |
| Separate-site hosted iframe | Preserved | Browser-dependent process separation; better containment in supporting profiles | Uniform behavior across engines or hard memory/CPU limits |
| `Origin-Agent-Cluster: ?1` | Preserved | Requests origin-keyed resource separation | A browser obligation to honor the request; a per-frame budget |
| COOP/COEP | Requires header/embedding compatibility work | Cross-origin isolation mechanisms for applicable APIs | An app-controlled process allocator or heap cap |
| Worker plus DOM bridge | Substantial adaptation | Host-side worker termination, computation off the UI thread | Existing synchronous DOM semantics or fixed worker memory |
| Instrument loops/functions | Changes generated execution | Cooperative checks in covered code | Native calls, recursion, dynamic code, allocation, or malicious bypass protection |
| Supervised remote browser | Preserved inside remote browser | Independent termination and OS-enforced resource accounting | Local-only operation, zero added latency/cost, or automatic sandbox security |

`Origin-Agent-Cluster` is a request the browser may decline; do not use the
header or `window.originAgentCluster` as proof of a dedicated process or quota.
[MDN Origin-Agent-Cluster](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin-Agent-Cluster)

COOP/COEP enable the cross-origin-isolated state and associated APIs; this is
not a quota API. [MDN crossOriginIsolated](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)

Chromium and Firefox document site-oriented process architectures. WebKit's
architecture documentation distinguishes operation with site isolation enabled
and disabled; its dated implementation notes are not a current Safari release
support matrix. [Chromium design](https://www.chromium.org/developers/design-documents/site-isolation/),
[Firefox process architecture](https://firefox-source-docs.mozilla.org/overview/gecko.html),
[WebKit site isolation](https://docs.webkit.org/Deep%20Dive/SiteIsolation.html)

For a supervised Linux runner, `cpu.max` limits CPU bandwidth; a supervisor must
separately enforce elapsed time. `memory.max` constrains cgroup memory and can
invoke the cgroup OOM killer, with documented temporary overshoot caveats. The
whole browser process tree, including helper/GPU processes as applicable, must be
accounted for. Resource controls do not replace browser/OS sandboxing, credential
isolation, egress restrictions, or session cleanup. This is an architectural
proposal, not a deployed or validated service.
[Linux cgroup v2 controls](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html)

## Implementation contract: optional hosted preview

1. Extract the trusted bootstrap into a static preview entry served on a
   configurable, dedicated **separate site**. Keep the real compilers in the
   editor's worker. Avoid credentials, project source, and generated modules in
   URLs, cookies, server logs, or persisted preview-origin storage.
2. Keep `sandbox="allow-scripts"` without `allow-same-origin`, and preserve the
   existing CSP. Transfer builds by structured clone after a versioned handshake;
   validate the source window and a fresh document channel. The opaque child
   origin will still serialize as `null`; origin-string checks cannot replace
   window/channel checks. Reject obsolete generations and configure only trusted
   bootstrap endpoints, not arbitrary query-supplied destinations.
3. Add explicit local/hosted mode status and an actionable startup error. Keep
   source intact if the endpoint is unavailable. Retain local mode as a deliberate
   fallback; do not silently downgrade a claimed guarantee during a failure.
4. Verify imports, styles, error mapping, console, consecutive HMR, explicit
   reload, project replacement, mobile/fullscreen, and editor history across the
   transport. Add stop/restart only with clearly stated browser-dependent limits.
5. Run the responsiveness probe against the actual deployment and supported
   browser profiles. Require host responsiveness in the explicit isolation
   profiles while documenting the known blocking profiles. Do not turn those
   results into a claim of hard quotas.

Milestone 12 implements the local transport prototype and browser tests; see
[hosted preview](hosted-preview.md). A production separate-site bootstrap endpoint
has not been selected or deployed in this repository. The probe now serves the
generated static bootstrap for URL modes, using its versioned handshake, and
requires responsiveness in the explicit isolation profiles. The measurements
above remain the original Milestone 11 baseline.
If hard limits become a requirement, scope the supervised runner as its own
service ticket, including privacy, capacity, cleanup, and deployment decisions.
