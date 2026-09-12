import type { CompilationProject } from './contracts';

export const helloWorld: CompilationProject = {
  entry: '/src/main.ts',
  files: {
    '/src/App.btsx': `import Counter from './Counter.btsx'

main.page
  div.eyebrow BEAST → OCTANE → WEB
  h1 Hello, world.
  p.intro A small idea. A working application.
  p.description Edit this component and watch it come to life.
  Counter
  footer Built with Beast. Compiled by Octane.
`,
    '/src/Counter.btsx': `import { useState } from 'octane'

setup const [count, setCount] = useState(0);

section.counter
  span.caption A LITTLE INTERACTION
  div.counter-row
    button.step(aria-label="Decrease count" onClick={() => setCount(count - 1)}) −
    strong.value #{count}
    button.step(aria-label="Increase count" onClick={() => setCount(count + 1)}) +
  p.counter-note Go ahead. Give it a click.
`,
    '/src/main.ts': `import { createRoot } from 'octane';
import App from './App.btsx';
import './style.css';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container.');

createRoot(container).render(App, {});
console.info('Hello from the preview.');
`,
    '/src/style.css': `:root { color: light-dark(#252723, #e1e1db); background: light-dark(#faf9f5, #303030); color-scheme: inherit; }
.page { max-width: 620px; margin: 0 auto; padding: 80px 40px; }
.eyebrow { color: light-dark(#ba4915, #ff773d); font-size: 10px; letter-spacing: .16em; font-weight: 650; }
h1 { margin: 25px 0 14px; font-size: clamp(36px, 7vw, 52px); font-weight: 500; letter-spacing: -.06em; }
.intro { margin: 0 0 10px; font-size: 17px; }
.description { font-size: 13px; line-height: 1.8; color: light-dark(#65665e, #a1a19b); }
.counter { margin-top: 38px; padding: 24px; border: 1px solid light-dark(#d6d4cc, #454542); border-radius: 5px; box-shadow: inset 0 1px light-dark(#fffefa, #4b4b48); background: light-dark(#f1efe8, #2b2b2b); }
.caption { font-size: 9px; letter-spacing: .14em; color: light-dark(#62645a, #a7a7a0); }
.counter-row { display: flex; align-items: center; gap: 28px; margin: 24px 0; }
.step { width: 38px; height: 38px; border: 1px solid light-dark(#d1cec5, #191919); border-radius: 50%; box-shadow: inset 0 1px light-dark(#ffffff, #61615c), 0 2px 4px light-dark(#d1cec5, #191919); background: light-dark(#faf9f5, #343434); font-size: 22px; cursor: pointer; color: light-dark(#b84310, #ff6b25); }
.step:hover { background: light-dark(#e8e3d9, #42403d); }
.value { min-width: 30px; font-size: 38px; font-family: monospace; font-weight: 400; text-align: center; }
.counter-note { font-size: 11px; color: light-dark(#68695f, #9c9c96); margin: 0; }
footer { margin-top: 44px; font-size: 10px; color: light-dark(#72736a, #7e7e78); }
`,
  },
};

export interface PlaygroundExample {
  id: string;
  title: string;
  description: string;
  project: CompilationProject;
}

// Each project is self-contained: shared scaffolding is copied into its virtual files.
function exampleProject(app: string, files: Record<string, string> = {}): CompilationProject {
  return { entry: helloWorld.entry, files: {
    '/src/main.ts': helloWorld.files['/src/main.ts'].replace("console.info('Hello from the preview.');", ''),
    '/src/style.css': helloWorld.files['/src/style.css'] + `
.card { padding: 18px; margin: 16px 0; border: 1px solid currentColor; border-radius: 8px; }
label { display: block; margin: 16px 0 8px; }
input, button { font: inherit; padding: 8px 12px; max-width: 100%; }
button { cursor: pointer; margin: 8px 8px 8px 0; }
button:disabled { cursor: wait; opacity: .6; }
ul { padding-left: 20px; }
li { margin: 8px 0; }
@media (max-width: 420px) { .page { padding: 32px 20px; } }
`,
    '/src/App.btsx': app,
    ...files,
  } };
}

export const examples: readonly PlaygroundExample[] = [
  { id: 'hello-world', title: 'Hello world',
    description: 'Start with components, local state, click events, and an imported stylesheet.', project: helloWorld },
  { id: 'props', title: 'Props & components',
    description: 'Pass typed props to two instances of a reusable greeting component. Edit a name to update its greeting.',
    project: exampleProject(`import { useState } from 'octane'
import Greeting from './Greeting.btsx'

setup const [name, setName] = useState('Ada');

main.page
  h1 Props & components
  p.description One component, two sets of props.
  label(for='name') Your name
  input#name(value={name} onInput={event => setName(event.currentTarget.value)})
  Greeting(name={name || 'friend'} role='Explorer')
  Greeting(name='Grace' role='Compiler pioneer')
`, { '/src/Greeting.btsx': `props { name, role }: { name: string; role: string }

article.card
  h2 Hello, #{name}!
  p #{role}
` }) },
  { id: 'events', title: 'State & events',
    description: 'Handle input, keyboard, and click events, update state, and render a keyed list with an empty state. Everything runs locally.',
    project: exampleProject(`import { useState } from 'octane'

setup
  const [draft, setDraft] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setItems(previous => previous.includes(text) ? previous : [...previous, text]);
    setDraft('');
  };

main.page
  h1 State & events
  p.description Add unique ideas, then clear the list to see its empty state.
  section
    label(for='idea') New idea
    input#idea(value={draft} onInput={event => setDraft(event.currentTarget.value)} onKeyDown={event => { if (event.key === 'Enter') add(); }})
    button(type='button' onClick={add} disabled={!draft.trim()}) Add idea
  ul
    each item in items key item
      li #{item}
    empty
      li No ideas yet.
  button(type='button' onClick={() => setItems([])} disabled={items.length === 0}) Clear ideas
`) },
  { id: 'nested-components', title: 'Nested components',
    description: 'Follow imports from App to Team to Member. Each member owns independent state inside a keyed list.',
    project: exampleProject(`import Team from './components/Team.btsx'

main.page
  h1 Nested components
  p.description Each member keeps an independent applause count.
  Team
`, {
      '/src/components/Team.btsx': `import Member from './Member.btsx'
import { members } from '../members'

section
  h2 Compiler team
  each member in members key member.id
    Member(name={member.name})
`,
      '/src/components/Member.btsx': `import { useState } from 'octane'

props { name }: { name: string }
setup const [applause, setApplause] = useState(0);

article.card
  h3 #{name}
  button(type='button' onClick={() => setApplause(value => value + 1)}) Applaud #{name}
  p(role='status') #{applause} applause
`,
      '/src/members.ts': `export const members = [
  { id: 'ada', name: 'Ada' },
  { id: 'grace', name: 'Grace' },
];
`,
    }) },
  { id: 'async', title: 'Async loading & recovery',
    description: 'Await a simulated request and show loading, success, and failure states. Try a failure, then load again to recover. No network required.',
    project: exampleProject(`import { useState } from 'octane'
import { loadMessage } from './request'

setup
  const [status, setStatus, getStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const load = async (fail: boolean) => {
    if (getStatus() === 'loading') return;
    setStatus('loading');
    setMessage('');
    try {
      setMessage(await loadMessage(fail));
      setStatus('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed.');
      setStatus('error');
    }
  };

main.page
  h1 Async loading & recovery
  p.description A simulated request takes one second. Try both outcomes.
  button(type='button' disabled={status === 'loading'} onClick={() => void load(false)}) Load message
  button(type='button' disabled={status === 'loading'} onClick={() => void load(true)}) Simulate failure
  if status === 'loading'
    p(role='status') Loading message…
  elseif status === 'error'
    p(role='alert') #{message}
  elseif status === 'success'
    p(role='status') #{message}
  else
    p(role='status') Ready when you are.
`, { '/src/request.ts': `// A deterministic local stand-in for a network request.
export async function loadMessage(fail: boolean): Promise<string> {
  await new Promise<void>(resolve => setTimeout(resolve, 1000));
  if (fail) throw new Error('The simulated request failed. Try loading again.');
  return 'Your async message has arrived.';
}
` }) },
  { id: 'reducer-history', title: 'Reducer & undo history',
    description: 'Keep related updates in a typed reducer. Undo and redo a counter, then make a new edit to discard the redo branch.',
    project: exampleProject(`import { useReducer } from 'octane'
import { historyReducer, initialHistory } from './history'

setup const [history, dispatch] = useReducer(historyReducer, initialHistory);

main.page
  h1 Reducer & undo history
  p.description A reducer owns the current count and both history stacks.
  p(role='status') Count: #{history.present}
  button(type='button' onClick={() => dispatch({ type: 'change', delta: -1 })}) Decrease
  button(type='button' onClick={() => dispatch({ type: 'change', delta: 1 })}) Increase
  button(type='button' disabled={history.past.length === 0} onClick={() => dispatch({ type: 'undo' })}) Undo
  button(type='button' disabled={history.future.length === 0} onClick={() => dispatch({ type: 'redo' })}) Redo
  p History: #{history.past.length} undo / #{history.future.length} redo
`, { '/src/history.ts': `export interface History { past: number[]; present: number; future: number[] }
export type Action = { type: 'change'; delta: number } | { type: 'undo' } | { type: 'redo' };
export const initialHistory: History = { past: [], present: 0, future: [] };

// Return fresh arrays; never mutate a previous state. Keep the latest 50 steps.
export function historyReducer(state: History, action: Action): History {
  switch (action.type) {
    case 'change': return { past: [...state.past, state.present].slice(-50), present: state.present + action.delta, future: [] };
    case 'undo': {
      if (!state.past.length) return state;
      return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] };
    }
    case 'redo': {
      if (!state.future.length) return state;
      return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
    }
  }
}
` }) },
  { id: 'context', title: 'Context & nested providers',
    description: 'Share a display preference across distant components. A nested provider overrides one branch while a consumer outside the provider uses the default.',
    project: exampleProject(`import { useState } from 'octane'
import { DensityContext } from './density'
import DensityCard from './DensityCard.btsx'
import Workspace from './Workspace.btsx'

setup const [density, setDensity] = useState('comfortable');

main.page
  h1 Context & nested providers
  p.description Toggle the shared preference and compare the three scopes.
  button(type='button' onClick={() => setDensity(value => value === 'comfortable' ? 'compact' : 'comfortable')}) Toggle density
  DensityContext.Provider(value={density})
    Workspace
    DensityContext.Provider(value='compact')
      DensityCard(label='Nested override')
  DensityCard(label='Outside provider')
`, {
      '/src/density.ts': `import { createContext } from 'octane';

export const DensityContext = createContext('comfortable');
`,
      '/src/Workspace.btsx': `import DensityCard from './DensityCard.btsx'

section
  h2 Shared workspace
  DensityCard(label='Shared preference')
`,
      '/src/DensityCard.btsx': `import { useContext } from 'octane'
import { DensityContext } from './density'

props { label }: { label: string }
setup const density = useContext(DensityContext);

article.card(style={{ padding: density === 'compact' ? '8px' : '24px' }})
  h3 #{label}
  p(role='status') Density: #{density}
`,
    }) },
  { id: 'effect-cleanup', title: 'Effects & subscription cleanup',
    description: 'Subscribe to local browser events in an effect, then unmount the component to remove the listener. Remount it to start with fresh state.',
    project: exampleProject(`import { useState } from 'octane'
import Listener from './Listener.btsx'

setup const [visible, setVisible] = useState(true);

main.page
  h1 Effects & subscription cleanup
  p.description Send a local signal. Hide the listener and inspect the console for cleanup.
  button(type='button' onClick={() => window.dispatchEvent(new Event('recipe-signal'))}) Send signal
  button(type='button' onClick={() => setVisible(value => !value)}) #{visible ? 'Hide listener' : 'Show listener'}
  if visible
    Listener
  else
    p(role='status') Listener is unmounted.
`, { '/src/Listener.btsx': `import { useEffect, useState } from 'octane'

setup
  const [signals, setSignals] = useState(0);
  useEffect(() => {
    const receive = () => {
      setSignals(value => value + 1);
      console.info('Listener received a signal.');
    };
    window.addEventListener('recipe-signal', receive);
    console.info('Listener connected.');
    return () => {
      window.removeEventListener('recipe-signal', receive);
      console.info('Listener disconnected.');
    };
  }, []);

section.card
  h2 Active listener
  p(role='status') Signals received: #{signals}
` }) },
];
