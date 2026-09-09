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
    '/src/style.css': `:root { color: #292b28; background: #f8f9f5; }
.page { max-width: 620px; margin: 0 auto; padding: 80px 40px; }
.eyebrow { color: #727a67; font-size: 10px; letter-spacing: .16em; font-weight: 650; }
h1 { margin: 25px 0 14px; font-size: clamp(36px, 7vw, 52px); font-weight: 500; letter-spacing: -.06em; }
.intro { margin: 0 0 10px; font-size: 17px; }
.description { font-size: 13px; line-height: 1.8; color: #85887e; }
.counter { margin-top: 38px; padding: 24px; border: 1px solid #dfe3d6; border-radius: 12px; background: #eff2e8; }
.caption { font-size: 9px; letter-spacing: .14em; color: #78816a; }
.counter-row { display: flex; align-items: center; gap: 28px; margin: 24px 0; }
.step { width: 38px; height: 38px; border: 1px solid #d3d9c8; border-radius: 8px; background: #fafbf6; font-size: 22px; cursor: pointer; color: #56614b; }
.step:hover { background: #dfe8ce; }
.value { min-width: 30px; font-size: 32px; font-weight: 500; text-align: center; }
.counter-note { font-size: 11px; color: #818975; margin: 0; }
footer { margin-top: 44px; font-size: 10px; color: #9a9f91; }
`,
  },
};
