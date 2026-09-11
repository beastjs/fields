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
