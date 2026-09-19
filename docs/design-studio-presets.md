# Design Studio presets

Section presets are JSON documents stored in Convex. This describes the document
model, the guarantees the parser and renderer hold, and how the built-in catalog
is seeded.

## Why a document, not a source string

The first catalog stored each section as a Beast source string in a `.ts` file.
A class string is not addressable: nothing can bind a padding handle to
`px-6 py-16 text-center sm:px-16`, and a hovered element in the preview cannot be
traced back to the thing that produced it. Presets are now a node tree, so a
node has an id, and spacing, sizing and typography are fields rather than text.

## The model

`src/playground/studio/ir/types.ts` defines it. A `PresetDocument` carries
catalog metadata, optional `imports`, an optional `setup` block, and a `root`
element.

Nodes are `element`, `each`, `if`, or `component`. An element's styling lives in
a typed `Style`:

| Group | Holds | Edited by Design Mode |
| --- | --- | --- |
| `layout` | display, flex direction, alignment, grid tracks | yes |
| `spacing` | padding, margin, gap | yes |
| `size` | width, height, min/max | yes |
| `text` | size, weight, tracking, leading, alignment | yes |
| `surface` | radius, border widths | yes |
| `position` | position, inset, z | yes |
| `raw` | every other utility, in source order | no — preserved verbatim |
| `at` | per-breakpoint overrides of the groups above | yes |
| `dyn` | a TypeScript expression appended to the class list | no — shown, not rewritten |

`raw` and `dyn` are what make the model honest. Colours, gradients, masks,
transitions and state variants (`hover:`, `dark:`) are not modelled, so they
survive untouched; a conditional class list keeps its static half typed and its
condition verbatim. Behaviour is not modelled either: `useState`, handlers and
derived values stay as opaque TypeScript in `setup`, and nodes reference them
through expression bindings.

Values are stored exactly as they appear after the utility's dash — `4`, `4xl`,
`[42rem]`, `-4` — so the pair of conversions is lossless by construction.

## Guarantees

`tests/studio-ir.test.ts` holds these for all 44 built-in templates:

- **Lossless.** `renderPreset(parsePreset(source))` equals the original source,
  byte for byte, once the tokens inside each `className` are sorted. No utility
  is dropped, invented or rewritten; class order is canonicalised.
- **Idempotent.** Parsing a rendered document reproduces the same document, so a
  preset survives any number of install round-trips.
- **Stable ids.** Node ids are assigned in document order, so re-parsing yields
  the same ids and a page's Design Mode overrides keep pointing at the nodes they
  were made against.
- **Compiles.** Every rendered section still compiles as part of a page.

## Storage

Convex is the source of truth. `sectionPresets`, `themes` and `pageRecipes` are
defined in `convex/schema.ts`; the functions are in `convex/presets.ts`.

Three properties of Convex shape how a preset is stored. `ir/storage.ts` handles
all of them, and `flattenPreset` / `inflatePreset` are exact inverses.

**Documents cannot nest past 16 levels.** A recursive node tree costs roughly two
levels per element, so a real section blows the limit at around eight — the first
seed attempt failed on `topbar-dashboard` at 17. A stored preset is therefore a
flat node list: each node names its `parent`, the `slot` it fills (`children`, an
`if` branch `b0`/`b1`, or `else`) and its `order` within that slot. That puts the
stored form at 7 levels regardless of how deep the section goes, and the runtime
model stays a tree. Writes are checked against `MAX_STORED_DEPTH` rather than
left to fail inside the insert, with two levels of headroom for the argument
wrapper a mutation adds.

**Object key order is not preserved.** Convex returns keys alphabetised, so
nothing stored may encode order in its keys. Attributes are stored as an ordered
array of `{ name, value }` rather than a record — otherwise a section's root
comes back as `className` before `data-section`. `tests/studio-ir.test.ts`
reorders every key of every stored preset and asserts the rendered source is
unchanged, so this cannot regress. Class order is safe by other means: `raw` is an
array, and the renderer walks breakpoints and style groups in a fixed order rather
than iterating stored keys.

**Validators cannot recurse.** The node list is stored under `document` as
`v.any()` and validated with the zod schema in `ir/schema.ts` on every write and
before it is returned. That schema is the trust boundary: a malformed document is
rejected rather than rendered into a project's source. `ir/types.ts`,
`ir/storage.ts` and `ir/schema.ts` depend on nothing but zod, so both runtimes can
import them.

Queries return the flat form and the client rebuilds the tree, which keeps every
value on the wire shallow too.

Listing returns summaries only — title, description, wireframe, keywords. A
preset's tree is fetched when it is previewed or added, so opening the library
costs one small, cached, reactive query instead of the whole catalog (172 KB).

Built-in presets have no `teamId` and are readable by anyone. A team's own
presets are readable by its members and are written through `presets.save`;
built-ins are seeded and are never writable over the public API.

One thing to watch: `content` is still a record, so if content fields ever need a
display order, they need the same treatment as attributes. Nothing populates it
yet.

## Seeding

The `.ts` templates under `src/playground/studio/sections` remain the authoring
source for the built-ins. `scripts/seed-presets.ts` parses them, asserts each one
round-trips through both the renderer and the flattener, checks its depth,
validates the result, and pushes it in batches:

```sh
bun run seed:presets --dry-run   # parse and validate only
bun run seed:presets             # push to the configured deployment
```

Seeding is idempotent: re-running patches each preset in place and bumps its
`version`. The functions must be deployed first (`npx convex dev`), which the
script says explicitly if they are not.

Section *kinds* stay in code. A kind implies a component name and a stage in the
page's story that `studio/page.ts` depends on at build time, so adding one is a
code change; adding a preset is not.

## Still to come

- The studio reads presets from Convex instead of the bundled catalog. This is
  the remaining half of the migration: `studio/page.ts` resolves templates
  synchronously today (`blockSource`, `planPageInstall`, `readPage` all compare a
  project's files against template sources), so it needs a loaded-preset cache
  before the bundled catalog can be retired.
- Themes as Tailwind v4 `@theme` custom properties, so switching a theme updates
  one `<style>` node in the preview instead of recompiling.
- Design Mode: an inspector in the preview bootstrap that reports the hovered
  node's id and box, an overlay drawn in host DOM over the iframe, and edits that
  land as non-destructive per-node overrides on the page document.
