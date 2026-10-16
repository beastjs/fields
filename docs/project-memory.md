# Project chat memory

The live playground chat uses the memory design from `~/Code/victral`, source
revision `162b20643`. `src/chat/memory.ts` adapts its binary summary tree,
age-weighted sibling selection, batch thresholds, saved views, and original
message retrieval to browser TypeScript. It does not depend on Victral's local
checkout, filesystem storage, Effect 4 runtime, or terminal UI.

Each signed-in **project ID** has one memory instance in Convex. Chats in that
project share it. Switching projects cancels the current response, closes its
compactor, clears the visible conversation, and opens the selected project's
memory. Renaming a project or editing its files preserves the instance.
Signing out closes cloud memory. Guests use a separate IndexedDB record for the
single local workspace; guest and cloud histories are never implicitly merged.
Project exports and share links contain source only, without chat memory or keys.

**New chat** clears the visible conversation and retains project memory.
Reloading also starts a blank conversation while restoring stored memory;
old edit proposals are not replayed into the editor. The status line reports
the number of stored message chunks. Only completed manual exchanges enter
memory; intermediate file requests, automatic repairs, failed replies, and
interrupted streams do not. Historical assistant changes are labeled as
proposals. Current attached source always takes precedence over memory.

Original messages are stored losslessly in UTF-8 chunks of at most 30,000 bytes.
Every leaf and complete binary parent gets a summary. Source that fits in 512
bytes is copied exactly. Longer source uses the currently selected chat model
and provider, up to eight concurrent jobs, with up to five attempts to meet the
512-byte target. As in Victral, the shortest complete result is retained even
if all five exceed the target; summaries are never cut mid-thought. Compaction
uses the existing server proxy, so server keys stay server-side. It can make
additional provider requests using the user's configured model.

The main view merges sibling pairs after exceeding 128,000 bytes, toward 64,000
bytes. Compaction has its own saved 32,000/16,000-byte view. Pair age is measured
from its last message in child-line units. Both exact view ranges and unfinished
work survive reloads. The browser runs compaction while the workspace is open;
unfinished work resumes before the next manual request. Summary failure keeps
originals intact and retries on the next request. A request waits for a complete,
bounded view instead of silently dropping old messages.

The assistant can request details using a `memory` fence containing
`{"id": 0, "n": 1, "page": 0}`. The controller resolves it against the active
instance and continues the same request. `n=1` returns the original message;
larger aligned powers of two return child summaries. Retrieval is bounded and
has a round limit. It never reads another project's instance or host files.

Convex stores immutable originals and summaries as individual indexed records,
with a bounded state document for each project. All public reads and writes
require project team membership. Pagination checks a stable revision; writes
compare the expected revision atomically. Guest storage uses the same revision
check inside an IndexedDB transaction. A stale tab reports a conflict and keeps
the committed memory intact; reload or reopen the project to continue.

Validation: `bun run check`, `bun run test:convex`, and
`bunx playwright test e2e/chat-memory.spec.ts --project chromium`.
