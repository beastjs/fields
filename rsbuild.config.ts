import { defineConfig } from '@rsbuild/core';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';
import { beastOctane } from 'beast-tsrx/rsbuild';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { aiMiddleware } from './server/middleware';
import { validatePreviewURL } from './src/playground/preview-config';

const require = createRequire(import.meta.url);
// Beast 0.2.60's root also exports Node project APIs. Reuse its exact compiler
// implementation in browsers until the package provides a pure compiler export.
const beastCompiler = join(dirname(require.resolve('beast-tsrx')), 'compiler.js');

export default defineConfig({
  server: { host: '127.0.0.1', setup: ({ server }) => { server.middlewares.use(aiMiddleware); } },
  source: {
    entry: { index: './src/main.ts' },
    define: { __HOSTED_PREVIEW_URL__: JSON.stringify(validatePreviewURL(process.env.PLAYGROUND_PREVIEW_URL) ?? '') },
  },
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
