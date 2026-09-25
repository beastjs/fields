import type { CompilationProject } from '../contracts'
import { storeFiles } from '../../generated/fullstack'

export const fullstackExample = {
  id: 'form-supply', title: 'Form Supply',
  description: 'A considered store for curious people. 36 illustrated robotics and workshop products, a searchable catalog, persistent guest bags, and demo checkout.',
  features: ['36 products · 6 collections', 'Search, filter & sort', 'Product detail dialogs', 'Persistent guest cart', 'Server-calculated checkout', 'Editable frontend + Convex backend']
}

/** Each installation gets a different preview guest session; no account credentials enter virtual files. */
export function createStoreProject(backendUrl: string, previewSession: string): CompilationProject {
  if (!/^[a-f0-9]{64}$/.test(previewSession)) throw new Error('A fresh demo session is required.')
  if (backendUrl && !/^https:\/\/[a-z0-9-]+\.convex\.cloud$/.test(backendUrl)) throw new Error('Choose a valid Convex deployment URL.')
  return { entry: '/src/main.ts', files: {
    ...storeFiles,
    '/src/config.ts': `// Public demo endpoint. Deploy the included backend and replace this URL to own your store.\nexport const backendUrl = ${JSON.stringify(backendUrl)};\n// Demo-only guest capability for this sandboxed preview. Never put user data or payment secrets here.\nexport const previewSession = ${JSON.stringify(previewSession)};\n`,
    '/convex/schema.ts': `import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { storeProductValidator, storeCartItemValidator, storeOrderValidator } from './storeDemoValidators';
export default defineSchema({
  storeDemoProducts: defineTable(storeProductValidator).index('by_sku', ['sku']),
  storeDemoCarts: defineTable({ token: v.string(), items: v.array(storeCartItemValidator), updatedAt: v.number() }).index('by_token', ['token']),
  storeDemoOrders: defineTable({ ...storeOrderValidator.fields, token: v.string(), requestId: v.string() }).index('by_token', ['token']).index('by_token_and_requestId', ['token', 'requestId'])
});\n`,
    '/convex/convex.config.ts': `import { defineApp } from 'convex/server';\nimport rateLimiter from '@convex-dev/rate-limiter/convex.config';\nconst app = defineApp();\napp.use(rateLimiter);\nexport default app;\n`,
    '/package.json': JSON.stringify({name:'form-supply',version:'1.0.0',private:true,type:'module',scripts:{dev:'rsbuild dev',build:'rsbuild build',backend:'convex dev',seed:'convex run storeDemo:seed'},dependencies:{octane:'0.2.10','@octanejs/tanstack-form':'0.0.48',convex:'^1.45.0','@convex-dev/rate-limiter':'0.4.0'},devDependencies:{'@rsbuild/core':'^2.2.2','@rsbuild/plugin-tailwindcss':'^2.0.3','beast-tsrx':'^0.2.60',tailwindcss:'^4.3.3',typescript:'^5.9.3'}},null,2) + '\n',
    '/rsbuild.config.ts': `import { defineConfig } from '@rsbuild/core';\nimport { beastOctane } from 'beast-tsrx/rsbuild';\nimport { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';\nexport default defineConfig({ source: { entry: { index: './src/main.ts' } }, html: { template: './index.html' }, plugins: [pluginTailwindcss(), ...beastOctane()] });\n`,
    '/index.html': '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Form Supply</title></head><body><div id="app"></div></body></html>\n',
    '/README.md': `# Form Supply — Fullstack example

A complete example store inspired by the warm palette, oversized typography, and illustrated hardware of https://www.mindrobotics.com/. Branding, drawings, products, and copy are original.

## Try it in the playground

The frontend connects to the playground development demo backend configured in src/config.ts. Browse 36 products, search and filter the collection, open product details, add items, edit quantities, and place a demo order. Carts and orders are stored in Convex. Prices and stock limits are validated on the server. A repeated checkout request returns its original order.

This is a demonstration, not a payment integration. No payment credentials, addresses, email, or other personal data are collected. Inventory is illustrative: demo orders do not reduce global stock. Standard demo shipping is $9, free from $150; express is $25. All prices are USD, with no tax calculation.

## Run your own copy

1. Export the project files, then run npm install.
2. Run npm run backend to create/connect your own Convex deployment and generate convex/_generated.
3. Run npm run seed to populate your own 36-product catalog.
4. Set backendUrl in src/config.ts to your Convex cloud URL.
5. Run npm run dev. Run npm run build for a static frontend build. Deploy the frontend with your chosen hosting provider; deploy backend changes with the Convex CLI.

## Guest sessions

On an ordinary hosted page, a random guest capability is kept in browser localStorage; clearing it starts a new bag. The opaque editor preview cannot use localStorage, so it uses the generated previewSession in config.ts. A shared project shares that demo preview capability. Keep only fictitious data here; add proper authenticated ownership before adapting this to customer data.

## Structure

- src/App.btsx — store UI, filters, product details, bag, and order confirmation
- src/ProductArt.btsx — six original editable SVG product families
- src/store.ts — typed Convex HTTP calls and guest session handling
- src/style.css — responsive art direction and reduced-motion support
- convex/storeDemo.ts — product query, guest cart mutations, idempotent checkout, seed
- convex/schema.ts — indexed products, carts, and orders
- convex/seedData.ts — editable product seed data

The existing Recipes catalog is separate from this Fullstack example.
`
  } }
}
