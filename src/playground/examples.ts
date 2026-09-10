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
    '/src/style.css': `:root { color: #e1e1db; background: #303030; color-scheme: dark; }
.page { max-width: 620px; margin: 0 auto; padding: 80px 40px; }
.eyebrow { color: #ff773d; font-size: 10px; letter-spacing: .16em; font-weight: 650; }
h1 { margin: 25px 0 14px; font-size: clamp(36px, 7vw, 52px); font-weight: 500; letter-spacing: -.06em; }
.intro { margin: 0 0 10px; font-size: 17px; }
.description { font-size: 13px; line-height: 1.8; color: #a1a19b; }
.counter { margin-top: 38px; padding: 24px; border: 1px solid #454542; border-radius: 5px; box-shadow: inset 0 1px #4b4b48; background: #2b2b2b; }
.caption { font-size: 9px; letter-spacing: .14em; color: #a7a7a0; }
.counter-row { display: flex; align-items: center; gap: 28px; margin: 24px 0; }
.step { width: 38px; height: 38px; border: 1px solid #191919; border-radius: 50%; box-shadow: inset 0 1px #61615c, 0 2px 4px #191919; background: #343434; font-size: 22px; cursor: pointer; color: #ff6b25; }
.step:hover { background: #42403d; }
.value { min-width: 30px; font-size: 38px; font-family: monospace; font-weight: 400; text-align: center; }
.counter-note { font-size: 11px; color: #9c9c96; margin: 0; }
footer { margin-top: 44px; font-size: 10px; color: #7e7e78; }
`,
  },
};
