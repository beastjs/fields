import { expect, test, type Page } from '@playwright/test';
import type { ChatRequest } from '../src/chat/contracts';
import { helloWorld } from '../src/playground/examples';
import { PROJECT_STORAGE_KEY } from '../src/playground/project-storage';

test.use({ viewport: { width: 720, height: 960 } });

const theme = ':root { --brand: tomato; }';
const project = { ...helloWorld, files: { ...helloWorld.files, '/src/theme.css': theme, '/src/notes.ts': 'export const notes = 1;' } };
const answer = `data: ${JSON.stringify({ choices: [{ delta: { content: 'References received.' } }] })}\n\ndata: [DONE]\n\n`;

async function ready(page: Page, configured = true, workspace = project, activeFile = '/src/App.btsx') {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { configured: { cohere: true, openrouter: false, custom: false } } }));
  await page.route('**/api/jev/status', route => route.fulfill({ json: { configured } }));
  await page.addInitScript(({ key, project, activeFile }) => localStorage.setItem(key, JSON.stringify({ version: 1, project, activeFile, preview: { width: '100%' } })), { key: PROJECT_STORAGE_KEY, project: workspace, activeFile });
  await page.goto('/playground');
  await expect(page.getByRole('textbox', { name: 'Message AI' })).toBeEnabled();
}

test('an imported hero remains selectable with Page attached and is sent only once', async ({ page }) => {
  const requests: ChatRequest[] = [];
  const workspace = { ...project, files: { ...project.files,
    '/src/Page.btsx': "import Hero from './sections/Hero.btsx'\n\nmain\n  Hero\n",
    '/src/sections/Hero.btsx': 'section\n  h1 Welcome\n',
  } };
  await page.route('**/api/ai/chat', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'text/event-stream', body: answer });
  });
  await ready(page, false, workspace, '/src/Page.btsx');
  const active = page.getByRole('checkbox', { name: /Include Page\.btsx/ });
  const hero = page.getByRole('checkbox', { name: 'Include sections/Hero.btsx as reference', exact: false });
  await expect(active).toBeChecked();
  await expect(hero).toBeChecked();
  await active.uncheck();
  await expect(hero).not.toBeChecked();
  await active.check();
  await expect(hero).toBeChecked();
  await hero.uncheck();
  await hero.check();
  await expect(active).toBeChecked();
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Explain the hero section');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-markdown')).toContainText('References received.');
  expect(requests[0].context?.file).toBe('/src/Page.btsx');
  expect(requests[0].references?.map(file => file.file)).toEqual(['/src/sections/Hero.btsx']);
});

for (const stale of [false, true]) {
  test(stale ? 'a reference edit cannot overwrite a newer Hero edit' : 'chat edits the auto-included Hero while Page is active', async ({ page }) => {
    const heroPath = '/src/sections/Hero.btsx';
    const pageSource = "import Hero from './sections/Hero.btsx'\n\nmain\n  Hero\n";
    const workspace = { ...project, files: { ...project.files,
      '/src/App.btsx': "import Page from './Page.btsx'\n\nPage\n",
      '/src/Page.btsx': pageSource,
      [heroPath]: 'section\n  h1 Original hero\n',
    } };
    const content = '```btsx patch=' + heroPath + '\n<<<<<<< SEARCH\n  h1 Original hero\n=======\n  h1 Updated hero\n>>>>>>> REPLACE\n```';
    await page.route('**/api/ai/chat', route => {
      const request = route.request().postDataJSON() as ChatRequest;
      expect(request.context?.file).toBe('/src/Page.btsx');
      expect(request.references?.find(reference => reference.file === heroPath)?.source).toBe(workspace.files[heroPath]);
      return route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n` });
    });
    await ready(page, false, workspace, '/src/Page.btsx');
    if (stale) await page.getByRole('checkbox', { name: /^Auto-apply/ }).uncheck();
    await page.getByRole('textbox', { name: 'Message AI' }).fill('Change the hero heading to Updated hero');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.locator('.chat-message.assistant')).toHaveAttribute('data-message-state', 'complete');
    if (stale) {
      await page.getByRole('button', { name: 'Show Files', exact: true }).click();
      await page.getByRole('button', { name: 'Open sections/Hero.btsx', exact: true }).click();
      await page.getByRole('button', { name: 'Show Editor', exact: true }).click();
      await page.getByRole('textbox', { name: 'Source editor' }).focus();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.insertText('section\n  h1 My newer hero\n');
      await page.getByRole('button', { name: 'Show Assistant', exact: true }).click();
      await page.getByRole('button', { name: 'Apply & verify', exact: true }).click();
      await expect(page.locator('.chat-apply-error')).toContainText('changed since this response');
    }
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).project.files['/src/sections/Hero.btsx'], PROJECT_STORAGE_KEY))
      .toBe(stale ? 'section\n  h1 My newer hero\n' : 'section\n  h1 Updated hero\n');
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).project.files['/src/Page.btsx'], PROJECT_STORAGE_KEY)).toBe(pageSource);
  });
}

test('Jev finishes selecting before chat sends, preserving manual picks and exclusions', async ({ page }) => {
  const requests: ChatRequest[] = [];
  let evaluations = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/jev/evaluate', async route => {
    evaluations++;
    const body = route.request().postDataJSON();
    expect(body.state.request).toBe('Use the brand color from theme.css');
    expect(route.request().headers().authorization).toBeUndefined();
    const questions = Object.entries(body.questions) as [string, { instructions: { file: string; outline: string } }][];
    expect(questions.map(([, q]) => q.instructions.file)).not.toContain('/src/Counter.btsx');
    expect(questions.map(([, q]) => q.instructions.file)).not.toContain('/src/notes.ts');
    expect(questions.find(([, q]) => q.instructions.file === '/src/theme.css')?.[1].instructions.outline).toBe(theme);
    await gate;
    await route.fulfill({ json: { model: 'jev-latest', usage: { input_tokens: 1, output_tokens: 1 }, answers: Object.fromEntries(questions.map(([id, q]) => [id, {
      type: 'score', score: q.instructions.file === '/src/theme.css' ? 1.9 : 0,
      confidence: 0.9, legend: { '0': 'Irrelevant', '1': 'Background', '2': 'Needed' }, probabilities: {},
    }])) } });
  });
  await page.route('**/api/ai/chat', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'text/event-stream', body: answer });
  });
  await ready(page);
  await page.getByRole('checkbox', { name: 'Include Counter.btsx as reference', exact: false }).uncheck();
  await page.getByRole('checkbox', { name: 'Include notes.ts as reference', exact: false }).check();
  const prompt = page.getByRole('textbox', { name: 'Message AI' });
  await prompt.fill('Use the brand color from theme.css');
  await prompt.press('Enter');
  await expect(page.getByText('Finding relevant files…')).toBeVisible();
  await expect.poll(() => evaluations).toBe(1);
  await prompt.press('Enter');
  expect(requests).toHaveLength(0);
  release();
  await expect(page.locator('.chat-markdown')).toContainText('References received.');
  expect(requests).toHaveLength(1);
  expect(evaluations).toBe(1);
  expect(requests[0].references?.map(file => file.file)).toEqual(['/src/notes.ts', '/src/theme.css', '/src/main.ts']);
  expect(requests[0].references?.[1].source).toBe(theme);
  await expect(page.locator('.chat-message.user code[title="/src/theme.css"]')).toBeVisible();
  await expect(prompt).toHaveValue('');
});

for (const cancellation of ['cancel', 'new chat', 'change file'] as const) {
  test(`${cancellation} during selection preserves the draft and never sends a stale message`, async ({ page }) => {
    let requests = 0;
    let started = false;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/jev/evaluate', async route => {
      started = true;
      await gate;
      await route.fulfill({ status: 503, json: { error: 'Unavailable' } }).catch(() => {});
    });
    await page.route('**/api/ai/chat', route => { requests++; return route.fulfill({ contentType: 'text/event-stream', body: answer }); });
    await ready(page);
    const prompt = page.getByRole('textbox', { name: 'Message AI' });
    await prompt.fill('Change the brand color');
    await prompt.press('Enter');
    await expect.poll(() => started).toBe(true);
    if (cancellation === 'cancel') await page.getByRole('button', { name: 'Cancel file selection' }).click();
    else if (cancellation === 'new chat') await page.getByRole('button', { name: 'New chat', exact: true }).click();
    else {
      await page.getByRole('button', { name: 'Show Files', exact: true }).click();
      await page.getByRole('button', { name: 'Open Counter.btsx', exact: true }).click();
      await page.getByRole('button', { name: 'Show Assistant', exact: true }).click();
    }
    release();
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeVisible();
    await expect(prompt).toHaveValue('Change the brand color');
    await expect(page.locator('.chat-message')).toHaveCount(0);
    expect(requests).toBe(0);
  });
}

test('a server without Jev still sends the existing import references', async ({ page }) => {
  const requests: ChatRequest[] = [];
  let evaluations = 0;
  await page.route('**/api/jev/evaluate', route => { evaluations++; return route.fulfill({ status: 503 }); });
  await page.route('**/api/ai/chat', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'text/event-stream', body: answer });
  });
  await ready(page, false);
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Explain this component');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-markdown')).toContainText('References received.');
  expect(evaluations).toBe(0);
  expect(requests[0].references?.map(file => file.file)).toEqual(['/src/Counter.btsx', '/src/main.ts']);
});

test('typing a top-bar request automatically checks its owning file before send and sends its source', async ({ page }) => {
  const topbar = '/src/sections/Topbar.btsx';
  const source = 'header\n  p Current announcement\n';
  const workspace = { ...project, files: { ...project.files, [topbar]: source } };
  const requests: ChatRequest[] = [];
  let evaluations = 0;
  await page.route('**/api/jev/evaluate', route => {
    evaluations++;
    const body = route.request().postDataJSON();
    const questions = Object.entries(body.questions) as [string, { instructions: { file: string; outline: string } }][];
    expect(body.state.request).toBe('Change the announcement text in the top bar');
    expect(questions.find(([, question]) => question.instructions.file === topbar)?.[1].instructions.outline).toBe(source);
    return route.fulfill({ json: { model: 'jev-latest', usage: { input_tokens: 1, output_tokens: 1 }, answers: Object.fromEntries(questions.map(([id, question]) => [id, {
      type: 'score', score: question.instructions.file === topbar ? 1.9 : 0, confidence: 0.9,
      legend: { '0': 'Irrelevant', '1': 'Background', '2': 'Needed' }, probabilities: {},
    }])) } });
  });
  await page.route('**/api/ai/chat', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'text/event-stream', body: answer });
  });
  await ready(page, true, workspace);
  const file = page.getByRole('checkbox', { name: 'Include sections/Topbar.btsx as reference', exact: false });
  await expect(file).not.toBeChecked();
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Change the announcement text in the top bar');
  await expect(file).toBeChecked();
  await expect(file.locator('..')).toContainText('Auto included');
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-message.assistant')).toHaveAttribute('data-message-state', 'complete');
  expect(requests[0].references).toContainEqual({ file: topbar, source });
  expect(evaluations).toBe(1);
});

test('reasoning and explanation collapse separately from the visible actionable diff', async ({ page }) => {
  const patch = '```btsx patch=/src/Counter.btsx\n<<<<<<< SEARCH\n  span.caption A LITTLE INTERACTION\n=======\n  span.caption TRY THE COUNTER\n>>>>>>> REPLACE\n```';
  const text = 'Rename the counter caption.\n\n' + patch;
  await page.route('**/api/ai/chat', route => route.fulfill({ contentType: 'text/event-stream', body:
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: 'The caption belongs to Counter.' } }] })}\n\n` +
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n` }));
  await ready(page, false);
  await page.getByRole('checkbox', { name: /^Auto-apply/ }).uncheck();
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Rename the counter caption');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const trigger = page.getByRole('button', { name: /Thinking & explanation/ });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.chat-change .chat-diff')).toBeVisible();
  await expect(page.locator('.chat-change')).not.toContainText('Rename the counter caption.');
  await expect(page.getByText('The caption belongs to Counter.', { exact: true })).not.toBeVisible();
  await trigger.click();
  await expect(page.getByText('The caption belongs to Counter.', { exact: true })).toBeVisible();
  await expect(page.locator('.chat-explanation')).toContainText('Rename the counter caption.');
  await expect(page.getByRole('button', { name: 'Apply & verify', exact: true })).toBeVisible();
});

test('a hallucinated Topbar hunk recovers using the original intent and exact current lines', async ({ page }) => {
  const file = '/src/sections/Topbar.btsx';
  const source = "header\n  nav\n    a(href='/signin') Sign in\n    a(href='/start') Get started\n";
  const workspace = { ...project, files: { ...project.files, [file]: source } };
  const requests: ChatRequest[] = [];
  await page.route('**/api/ai/chat', async route => {
    const request = route.request().postDataJSON() as ChatRequest;
    requests.push(request);
    const line = requests.length === 1 ? '    button Google' : "    a(href='/signin') Sign in";
    const content = '```btsx patch=' + file + '\n<<<<<<< SEARCH\n' + line + '\n=======\n' + "    a(href='/signin') Sign in with Google" + '\n>>>>>>> REPLACE\n```';
    await route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n` });
  });
  await ready(page, false, workspace, file);
  await page.getByRole('textbox', { name: 'Message AI' }).fill('replace sign in with Sign in with Google');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).project.files['/src/sections/Topbar.btsx'], PROJECT_STORAGE_KEY))
    .toBe(source.replace('Sign in', 'Sign in with Google'));
  expect(requests).toHaveLength(2);
  expect(requests[1].messages).toHaveLength(1);
  expect(requests[1].messages[0].content).toContain('Original developer request:\nreplace sign in with Sign in with Google');
  expect(requests[1].messages[0].content).toContain("    a(href='/signin') Sign in");
  expect(requests[1].messages[0].content).not.toContain('button Google');
});

test('the assistant fetches an unselected file and completes the same request', async ({ page }) => {
  const requests: ChatRequest[] = [];
  await page.route('**/api/ai/chat', route => {
    const request = route.request().postDataJSON() as ChatRequest;
    requests.push(request);
    const content = requests.length === 1 ? '```context\n["/src/notes.ts"]\n```'
      : '```ts patch=/src/notes.ts\n<<<<<<< SEARCH\nexport const notes = 1;\n=======\nexport const notes = 2;\n>>>>>>> REPLACE\n```';
    return route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n` });
  });
  await ready(page, false);
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Update the secondary value');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-apply')).toContainText('startup verified', { timeout: 25000 });
  expect(requests).toHaveLength(2);
  expect(requests[0].references?.some(file => file.file === '/src/notes.ts')).toBeFalsy();
  expect(requests[1].context?.file).toBe('/src/notes.ts');
  await expect(page.locator('.chat-message.assistant')).toHaveCount(1);
  await expect(page.locator('.chat-message.user')).toContainText('notes.ts');
});
