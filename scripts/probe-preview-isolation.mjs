/** Run with Bun. Uses temporary loopback servers and finite CPU work only. */
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { platform, release, arch } from 'node:os';
import { chromium, firefox, webkit } from '@playwright/test';
import { compileProject } from '../src/playground/compiler.ts';
import { previewDocument } from '../src/playground/preview.ts';
import { helloWorld } from '../src/playground/examples.ts';

const burnMs = 600;
const channel = crypto.randomUUID();
const document = previewDocument(channel, 1);
const hostedDocument = await readFile(new URL('../public/preview.html', import.meta.url), 'utf8');
const project = { ...helloWorld, files: { ...helloWorld.files } };
project.files['/src/main.ts'] += `
// Finite responsiveness probe; no allocation pressure or network access.
window.addEventListener('message', event => {
  if (event.source !== parent || event.data?.type !== 'probe-run' || event.data.channel !== '${channel}') return;
  const started = performance.now();
  while (performance.now() - started < ${burnMs}) { /* finite CPU work */ }
  parent.postMessage({ type: 'probe-done', channel: '${channel}', elapsed: performance.now() - started }, '*');
});
parent.postMessage({ type: 'probe-ready', channel: '${channel}' }, '*');
`;
const result = await compileProject(project);
if (!result.entry || result.diagnostics.some(d => d.severity === 'error')) throw new Error(JSON.stringify(result.diagnostics));

// 127.0.0.1 and localhost are distinct sites on the same loopback server.
const serve = (request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(request.url === '/preview' ? hostedDocument : '<!doctype html><title>Local isolation probe</title><body>Host responsiveness probe</body>');
};
const server = createServer(serve);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const report = {
  measuredAt: new Date().toISOString(), platform: `${platform()} ${release()} ${arch()}`,
  workload: { burnMs, heartbeatMs: 20, repetitions: 3, workerTerminateAfterMs: 100, workerFiniteFallbackMs: 2000 },
  scope: 'Headless Playwright defaults plus explicitly labelled isolation overrides on this machine; responsiveness observations, not process IDs or hard resource quotas.',
  engines: [],
};
try {
  const profiles = [
    { name: 'chromium', engine: chromium, options: {} },
    { name: 'firefox', engine: firefox, options: {} },
    { name: 'webkit', engine: webkit, options: {} },
    { name: 'chromium-site-per-process', engine: chromium, options: { args: ['--site-per-process'] } },
    { name: 'firefox-fission', engine: firefox, options: { firefoxUserPrefs: { 'fission.autostart': true, 'fission.webContentIsolationStrategy': 1 } } },
  ];
  for (const { name, engine, options } of profiles) {
    let browser;
    const watchdog = setTimeout(() => { void browser?.close(); }, 30000);
    try {
      browser = await engine.launch({ headless: true, timeout: 15000, ...options });
      const entry = { name, version: browser.version(), launchOverrides: options, samples: [] };
      const cdp = engine === chromium ? await browser.newBrowserCDPSession() : undefined;
      report.engines.push(entry);
      for (const mode of ['srcdoc', 'same-origin-url', 'cross-site-url', 'worker']) {
        for (let repetition = 1; repetition <= 3; repetition++) {
          const page = await browser.newPage();
          page.setDefaultTimeout(10000);
          await page.exposeFunction('probeIframeTargets', async () => {
            if (!cdp) return null;
            const targets = await cdp.send('Target.getTargets');
            return targets.targetInfos.filter(target => target.type === 'iframe').length;
          });
          await page.goto(`http://127.0.0.1:${port}/`);
          try {
            const sample = await page.evaluate(async ({ mode, port, document, result, channel }) => {
              // The Node/Bun supervisor below is independent of this page's event loop.
              const gaps = [];
              let last = performance.now();
              const clock = setInterval(() => { const now = performance.now(); gaps.push(now - last); last = now; }, 20);
              let frame;
              let worker;
              let workerURL;
              let listener;
              try {
                let startWork;
                let finished;
                let completed = false;
                if (mode === 'worker') {
                  workerURL = URL.createObjectURL(new Blob([`
                    onmessage = () => {
                      postMessage('started');
                      const start = performance.now();
                      while (performance.now() - start < 2000) {}
                      postMessage('finished');
                    };
                    postMessage('ready');
                  `], { type: 'text/javascript' }));
                  worker = new Worker(workerURL);
                  await new Promise(resolve => { worker.onmessage = event => { if (event.data === 'ready') resolve(); }; });
                  startWork = () => worker.postMessage('run');
                  finished = new Promise(resolve => {
                    worker.onmessage = event => {
                      if (event.data === 'finished') completed = true;
                      if (event.data === 'started') setTimeout(() => { worker.terminate(); resolve({ terminationIssued: true }); }, 100);
                    };
                  });
                } else {
                  frame = window.document.createElement('iframe');
                  frame.sandbox = 'allow-scripts';
                  let ready;
                  const booted = new Promise(resolve => { ready = resolve; });
                  let done;
                  finished = new Promise(resolve => { done = resolve; });
                  listener = event => {
                    if (event.source !== frame.contentWindow || event.data?.channel !== channel) return;
                    if (event.data.type === 'ready') frame.contentWindow.postMessage({ version: 1, channel, build: 1, type: 'load', modules: result.modules, entry: result.entry }, '*');
                    if (event.data.type === 'probe-ready') ready();
                    if (event.data.type === 'probe-done') done({ workElapsedMs: event.data.elapsed });
                    if (event.data.type === 'runtime-error') throw new Error(event.data.message);
                  };
                  addEventListener('message', listener);
                  if (mode === 'srcdoc') frame.srcdoc = document;
                  else {
                    frame.addEventListener('load', () => frame.contentWindow.postMessage({ version: 1, type: 'connect', channel, build: 1, theme: 'dark' }, '*'));
                    frame.src = `http://${mode === 'cross-site-url' ? 'localhost' : '127.0.0.1'}:${port}/preview`;
                  }
                  window.document.body.append(frame);
                  await booted;
                  startWork = () => frame.contentWindow.postMessage({ type: 'probe-run', channel }, '*');
                }
                const outOfProcessIframeTargets = await window.probeIframeTargets();
                await new Promise(resolve => setTimeout(resolve, 100));
                const baselineMaxGapMs = Math.max(0, ...gaps);
                gaps.length = 0;
                last = performance.now();
                const started = last;
                // This callback represents a watchdog/Stop handler in the editor.
                let hostCallbackAfterMs;
                const hostCallback = new Promise(resolve => setTimeout(() => {
                  hostCallbackAfterMs = performance.now() - started; resolve();
                }, 100));
                startWork();
                const outcome = await finished;
                await hostCallback;
                await new Promise(resolve => setTimeout(resolve, 100));
                return { outOfProcessIframeTargets, baselineMaxGapMs, maxHostGapMs: Math.max(0, ...gaps), hostCallbackAfterMs, ...outcome,
                  ...(mode === 'worker' ? { workerFinishedBeforeTermination: completed } : {}) };
              } finally {
                clearInterval(clock);
                if (listener) removeEventListener('message', listener);
                frame?.remove(); worker?.terminate();
                if (workerURL) URL.revokeObjectURL(workerURL);
              }
            }, { mode, port, document, result, channel });
            entry.samples.push({ mode, repetition, ...sample });
            console.error(`${name} ${mode} #${repetition}: host callback ${sample.hostCallbackAfterMs.toFixed(1)}ms, max gap ${sample.maxHostGapMs.toFixed(1)}ms`);
          } finally { await page.close(); }
        }
      }
      // Finite-work acceptance only for profiles deliberately configured for isolation.
      if (['chromium-site-per-process', 'firefox-fission'].includes(name)) {
        const samples = entry.samples.filter(sample => sample.mode === 'cross-site-url');
        const median = samples.map(sample => sample.hostCallbackAfterMs).sort((a, b) => a - b)[1];
        if (samples.length !== 3 || median >= burnMs / 2) throw new Error(`Hosted preview did not keep the host responsive: median ${median}ms`);
      }
    } catch (error) {
      report.failed = true;
      report.engines.push({ name, error: String(error) });
    } finally { clearTimeout(watchdog); await browser?.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
await mkdir('test-results', { recursive: true });
await writeFile('test-results/preview-isolation.json', JSON.stringify(report, null, 2) + '\n');
console.log('Wrote test-results/preview-isolation.json');
if (report.failed) process.exitCode = 1;
