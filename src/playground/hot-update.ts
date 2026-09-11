import type { CompilationResult, CompiledModule } from './contracts';

export interface HotUpdate { modules: CompiledModule[]; styles: { id: string; content: string }[] }
const projectImports = (imports: string[]) => imports.filter(id => !id.startsWith('@playground/@runtime/'));
/** Preserve the original import map and runtime singletons. Graph changes require a new realm. */
export function planHotUpdate(previous: CompilationResult, next: CompilationResult): HotUpdate | undefined {
  if (!next.entry || next.entry !== previous.entry || next.modules.length !== previous.modules.length) return;
  const old = new Map(previous.modules.map(module => [module.id, module]));
  const modules: CompiledModule[] = [], styles: HotUpdate['styles'] = [];
  for (const module of next.modules) {
    const before = old.get(module.id);
    if (!before) return;
    if (before.code === module.code) continue;
    if (module.id === next.entry || !before.hot || !module.hot || before.hot.kind !== module.hot.kind ||
      JSON.stringify(projectImports(before.hot.imports)) !== JSON.stringify(projectImports(module.hot.imports)) ||
      JSON.stringify(before.hot.exports) !== JSON.stringify(module.hot.exports)) return;
    if (module.hot.kind === 'style') {
      const asset = next.assets.find(asset => asset.id === module.source && asset.type === 'text/css');
      if (!asset) return;
      styles.push({ id: asset.id, content: asset.content });
    } else modules.push(module);
  }
  return { modules, styles };
}
