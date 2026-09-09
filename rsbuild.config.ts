import { defineConfig } from '@rsbuild/core';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';
import { beastOctane } from 'beast-tsrx/rsbuild';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// Beast 0.2.60's root also exports Node project APIs. Reuse its exact compiler
// implementation in browsers until the package provides a pure compiler export.
const beastCompiler = join(dirname(require.resolve('beast-tsrx')), 'compiler.js');

export default defineConfig({
  source: { entry: { index: './src/main.ts' } },
  html: { template: './index.html' },
  plugins: [pluginTailwindcss(), ...beastOctane()],
  resolve: { alias: { 'beast-tsrx$': beastCompiler } },
  tools: {
    rspack: (config, { rspack }) => {
      config.plugins ??= [];
      config.plugins.push(new rspack.NormalModuleReplacementPlugin(/^node:path$/, require.resolve('path-browserify')));
    },
  },
});
