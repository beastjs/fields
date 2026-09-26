import { createStoreProject } from '../project'
import { marginFiles } from '../../../generated/margin'

/** Reuse the export scaffolding; app source and backend data remain independent. */
export function createMarginProject(backendUrl: string, previewSession: string) {
  const project = createStoreProject(backendUrl, previewSession)
  delete project.files['/src/ProductArt.btsx']
  delete project.files['/convex/storeDemo.ts']
  Object.assign(project.files, marginFiles)
  project.files['/convex/schema.ts'] = project.files['/convex/schema.ts'].replaceAll('storeDemoProducts', 'marginDemoProducts').replaceAll('storeDemoCarts', 'marginDemoCarts').replaceAll('storeDemoOrders', 'marginDemoOrders').replace('export default defineSchema({', "export default defineSchema({\n  marginDemoShelves: defineTable({ token: v.string(), skus: v.array(v.string()) }).index('by_token', ['token']),")
  project.files['/index.html'] = project.files['/index.html'].replace('Form Supply', 'Margin Notes')
  project.files['/package.json'] = project.files['/package.json'].replace('form-supply', 'margin-notes').replace('storeDemo:seed', 'marginDemo:seed')
  project.files['/README.md'] = `# Margin Notes — Fullstack bookshop

Inspired by the oversized serif typography, grid, and layered editorial composition at https://moneyincheck.org/. Uses a maroon-and-gold palette. All branding, titles, authors, cover drawings, and sample prose are original and fictional.

## Try the app

Browse 24 books across Fiction, Essays, Design, and Poetry. Search by title or author, sort and filter by price, read a sample, save books to your persistent reading shelf, and use the bag and demo checkout. No payments or personal information are collected. Nothing is shipped. All prices are USD. Standard demo delivery is $5, free from $75; express is $12. No tax calculation. Orders do not decrement global illustrative stock.

## Run your own copy

1. Export these files and run npm install.
2. Run npm run backend to connect your own Convex deployment and generate convex/_generated.
3. Run npm run seed to upsert the 24 original books.
4. Set backendUrl in src/config.ts to your Convex cloud URL.
5. Run npm run dev or npm run build for a static frontend.

The guest token in browser localStorage identifies a demo bag, reading shelf, and latest order. The opaque editor preview uses previewSession in config.ts instead; sharing a project shares that demo capability. Keep fictitious data here. Add authenticated ownership before using customer data.

## Source map

- src/App.btsx: complete interactive bookshop
- src/BookCover.btsx: editable cover drawings and typography
- src/store.ts: typed backend requests
- src/style.css: responsive design, textures, animation, reduced motion
- convex/marginDemo.ts: products, shelf, cart, checkout, and seed
- convex/seedData.ts: all 24 books
- convex/schema.ts: isolated bookshop tables

The seed is safe to rerun: it upserts by SKU and does not clear shelves, carts, or orders. Existing Form Supply data and the Recipes catalog are separate.
`
  return project
}
