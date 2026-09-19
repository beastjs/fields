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

## How the studio reads them

Composing and installing a page is synchronous — `page.ts` diffs a section's
source against the project, and the preview needs every block resolved before it
can build — so the studio loads what it needs and passes the rest of the code a
`PresetLookup` (`studio/presets.ts`) that answers from what is loaded.

Summaries drive the library: they carry the wireframe and the words, and nothing
there needs a tree. Trees are fetched only for the presets a page actually uses.
Search filters the loaded summaries rather than calling the server, since the
whole catalog is already in hand and a round trip per keystroke would be slower;
the `search_catalog` index is there for when team presets make the catalog large.

`Page.btsx` records which preset each section came from:

```
// Composed in Design Studio. Reorder sections there, or edit this file by hand.
// presets: Topbar=topbar-default, Hero=hero-default, Footer=footer-default
```

That marker is what makes the rest work. Reading a page back needs no documents —
the ids are known before anything loads, which is how the studio knows what to
fetch. It also replaced the old approach of identifying a section by matching its
file against every template's source, which would have meant loading the whole
catalog to read one page.

A block therefore carries both its `presetId` and an `edited` flag, set when the
project's file no longer matches the preset. Edited wins: the preview shows the
file, the install leaves it alone, and it is never removed. Choosing a new design
clears the flag, and the install warns before replacing an edit. A preset that has
not loaded yet reads as edited, so the preview shows the project's own file rather
than nothing, and corrects itself when the document arrives.

The section taxonomy stays in code (`studio/kinds.ts`), split out from
`catalog.ts` so the built-in template sources — seed material only — are not
pulled into the app bundle. Nothing in the app imports `catalog.ts`.

## Themes

A theme is only custom properties. Tailwind v4 compiles its utilities against
variables — `p-4` is `calc(var(--spacing) * 4)`, `rounded-lg` is
`var(--radius-lg)`, `text-xl` is `var(--text-xl)` — so once those utilities are in
the compiled stylesheet, changing the variables repaints everything without
touching a class name. Switching a theme sends one `tokens` message to the
preview, which swaps a single `<style>` node. No rebuild, no recompile, and the
44 presets are untouched.

Sections stay monochrome and derive colour from `currentColor`, so setting the
page's colour and background carries the palette through every `current/15` tint.
That is why a theme can change the whole product's look without a preset knowing
themes exist.

`themes.ts` maps token groups onto the variables Tailwind already uses:

| Token | Becomes | Effect |
| --- | --- | --- |
| `color.bg` / `.fg` / `.accent` | `--studio-bg` / `-fg` / `-accent` | page colour, inherited by every section |
| `color.<other>` | `--color-<key>` | makes `bg-<key>` and friends resolve |
| `radius.<step>` | `--radius-<step>` | every `rounded-*` at once |
| `spacing.base` | `--spacing` | every padding, margin and gap — density |
| `font.sans` | `--font-sans`, `--studio-font` | the page's typeface |

Token values are validated before they reach CSS: a key must be lowercase
alphanumeric and a value may not contain `;`, `{`, `}`, `<`, `>`, `@`, a backslash
or a comment opener. Anything else is dropped rather than escaped, because themes
can come from a team's own record. `tests/studio-themes.test.ts` feeds a hostile
theme through and asserts exactly one rule survives.

Theme CSS is emitted **unlayered**, while the studio's defaults sit in
`@layer base`. Unlayered rules beat any layer regardless of specificity, so a
theme overrides the defaults without having to match `:root[data-theme='light']`
selector for selector.

Installing writes the chosen theme last in the project stylesheet, between
`/* Design Studio theme: … */` and `/* end Design Studio theme */`. Switching
replaces that block rather than stacking, and choosing **Inherit** removes it,
leaving no stale variables. Re-installing the same theme is byte-identical, so the
button correctly reads as up to date.

## Still to come

- Design Mode: an inspector in the preview bootstrap that reports the hovered
  node's id and box, an overlay drawn in host DOM over the iframe, and edits that
  land as non-destructive per-node overrides on the page document.
- A persisted page document. The composition and the chosen theme are still
  component state today, so they only become durable when a page is added to the
  project.
- Accent colour is defined (`--studio-accent`) but no preset uses it yet, because
  nothing marks which element is a primary action. Promoting that into the preset
  content model is the natural next step.
