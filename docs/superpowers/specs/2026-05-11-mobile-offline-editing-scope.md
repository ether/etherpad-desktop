# Mobile offline editing — scoping (v2)

> **Status:** scoping document, not a design. The point of this doc is to
> surface the design forks so we can pick a direction before writing the
> v2 design proper.

## Problem

Today a mobile pad won't render at all without connectivity — the iframe
loads `https://<server>/p/<pad>` and that's a dead end offline. The user's
Phase 7 device test made the gap obvious: black/blocked iframe with no
fallback beyond "open in browser."

The asked-for v2 outcome:

> *"Embedded local Etherpad server on mobile with offline edits and sync
> on reconnection — likely via `nodejs-mobile` or a CRDT-backed offline
> queue."* — `docs/superpowers/specs/2026-05-11-etherpad-mobile-android-design.md` §v2

User picked the **CRDT offline queue** direction over `nodejs-mobile`.
Reasons (implied): smaller native footprint, no Node-on-Android stack,
no Etherpad server processes to manage on a phone, lower battery cost.

## Hard constraint: Etherpad's sync model is OT, not CRDT

Etherpad uses **Operational Transformation** (OT) via custom "changesets"
— a 20-year-old format where every keystroke ships as a transformation
of the previous server state. Concurrent edits are resolved by the
server transforming incoming changesets against the canonical history.

CRDT (Yjs, Automerge, etc.) is a fundamentally different model — each
peer can apply ops in any order and they commute. CRDT and OT do not
compose without a bridge.

Three implications:

1. **There's no off-the-shelf "Etherpad client that speaks CRDT".**
   Pure-mobile CRDT means the mobile client diverges from the server
   protocol; the bridge happens on sync.
2. **Concurrent edits between an online web client and an offline
   mobile client can't merge correctly via Etherpad's REST API.**
   `POST /setText` is destructive; the proper merge requires the
   changeset stream over WebSocket, which assumes both sides speak OT.
3. **Conflict semantics differ.** OT favours preserving intent ("user
   was typing here, even if the text shifted"); CRDT favours
   convergence ("everyone agrees what the doc looks like"). Users may
   see surprises when the two meet.

## Four design options

Listed cheapest first.

### A. Read-only offline snapshot (≈ 1 week)

When a pad opens online, cache its current text + last-revision number
via `GET /api/1.2.x/getText`. When offline, render the cached text
inside the shell (no editing). When online again, re-fetch.

**Pros:** trivial; no CRDT; no server changes; useful for "look up that
note while on the bus" scenarios. Ships before everything else.

**Cons:** read-only. Doesn't satisfy "offline edits."

**Practical fit:** good v2.0. Probably worth shipping standalone before
attempting writes.

### B. Local edit buffer + last-write-wins on sync (≈ 2-3 weeks)

When offline, the user edits a local mirror of the pad text (plain
textarea, or a minimal CodeMirror with no real-time anything). On
reconnect, `POST /setText` with the buffer. If the server has changed
since the snapshot's revision, prompt the user: "merge changes" (a
naive 3-way text merge via diff3) or "discard mine" or "keep mine."

**Pros:** simple; no new server protocol; existing Etherpad API; works
for solo authors who occasionally edit offline.

**Cons:** lossy if concurrent web edits happened while offline — naive
merge can produce garbage. Not collaborative offline. Single-user use
case mostly.

**Practical fit:** good v2.1 once v2.0 is in.

### C. Operation queue + replay over WebSocket (≈ 4-6 weeks)

When offline, record every keystroke as an Etherpad changeset against
the last-known server revision. When reconnected, open the pad's
WebSocket and replay queued changesets in order — Etherpad's OT
transforms them against any web edits made in the meantime.

**Pros:** uses Etherpad's existing OT semantics, so concurrent edits
merge "correctly" the way Etherpad already merges them. No server
changes. Closest to "real" Etherpad offline.

**Cons:** requires implementing changeset generation on mobile (the
diff-to-changeset logic lives in Etherpad's client today; we'd port it
or vendor it). Need to handle the case where queued changesets break
because the server document has diverged too much. Quite a bit of code
to write + test.

**Practical fit:** the "good enough for power users" target. Doesn't
need a new sync model — just better client glue.

### D. CRDT client + server plugin (`ep_yjs` or similar) (≈ 8-12 weeks)

Replace the on-pad editor (currently Etherpad's monolithic client) with
a Yjs-backed editor on mobile. Server-side, an Etherpad plugin (existing
prototype: `ep_yjs`, but it's unmaintained) maps Yjs updates onto
Etherpad changesets and back. Online or offline edits are the same
code path — Yjs handles the queue + sync automatically.

**Pros:** clean conflict resolution; same editor handles online +
offline transparently; no separate "sync logic" to maintain; matches
modern real-time apps' UX. Mobile-and-web could one day share the
CRDT editor.

**Cons:** biggest lift. Server-side plugin needs maintenance. Existing
Etherpad clients still speak OT — the plugin has to act as a bridge.
Multi-month effort, real risk of getting stuck on edge cases (Yjs ↔
OT round-tripping has subtle bugs that bite at scale).

**Practical fit:** the right end state, but probably not the next 3 PRs.

## Recommended phasing

| Phase | Scope | When |
|---|---|---|
| **v2.0** | Option A — read-only offline snapshot. Sidebar shows "📱 cached" badge per pad with the cache age. Tap to view; banner says "Offline (last synced N min ago) — reconnect to edit." | Next sprint |
| **v2.1** | Option B — single-user offline edit with last-write-wins merge prompt. Edits queued in IndexedDB. | Sprint after |
| **v2.2** | Option C — replay over WebSocket, no manual merge prompt. Etherpad's OT handles concurrent edits. | Quarter after |
| **v3.0** | Option D — Yjs-backed editor + `ep_yjs` plugin. Replaces v2.x mobile-specific code with a cross-platform offline-first editor. | Future |

This staircase keeps each step independently shippable and falsifiable —
if v2.0's adoption is low, v2.1+ aren't worth building. If v2.1's merge
prompts annoy users daily, that's the signal to skip ahead to v2.2.

## Open questions before drafting the v2.0 design

1. **What's the storage budget per pad on mobile?** `@capacitor/preferences`
   tops out around 6MB per key on Android (SharedPreferences soft limit).
   Pads can grow past that. We'd switch large pads to `@capacitor/filesystem`.
   How big are the user's typical pads? Decision impacts whether v2.0 needs
   the filesystem adapter from day one.

2. **Cache invalidation policy.** Per-pad TTL? Refresh-on-open? Manual
   "sync" button? What happens if the cached pad is from 2 weeks ago?

3. **Should we cache *every* pad in pad-history or only the ones the
   user has opened on mobile recently?** Opening 30 pads on desktop and
   then expecting them all to be cached on the phone is a footgun.

4. **What status should the UI show?** "synced" vs "stale" vs "offline"
   vs "unreachable" — currently the shell only has `tabState`
   loading/loaded/error/crashed. We'd add an offline indicator.

5. **Does the user have any existing Etherpad fork or plugin we should
   align with?** If they're already running `ep_socketio_logging` or
   similar, that could expose useful metadata cheaply.

6. **iOS pretty much rules out background sync.** Are we OK with
   "sync runs only when the app is open"? That's the v2.0/2.1 model.
   v2.2+ would want a service worker or background fetch.

## What scoping doesn't cover yet

These need their own focused decisions when their phase rolls around:

- The mobile editor itself for write modes. Today the iframe IS the
  editor. v2.1+ replaces it on the offline path; what does the online
  path do then? Two editors? One that's offline-capable always?
- Authentication — Etherpad's session cookies vs OAuth vs API key.
  Cached pads need to know whose pad they are.
- Multi-device merge (user edits the same pad offline on phone AND
  laptop, both reconnect). v2.2 + Etherpad's OT handles this; v2.1's
  merge prompt does not.
- Conflict UX in v2.1 — diff3 output is unreadable to non-engineers.
  Probably a real "side by side" merge view is needed; that's its own
  micro-spec.

## Recommendation

Start with **v2.0 (read-only offline snapshot)**. Two-PR rollout:

1. Add `padCache` table to mobile storage (Preferences for ≤4MB pads,
   Filesystem for the rest). On every iframe load, snapshot
   `GET /api/getText` and write to cache. Smoke test: cache hit on
   reload.
2. Detect offline (`navigator.onLine` + `@capacitor/network` ping). When
   offline, hide the iframe behind a "📱 viewing offline cache" overlay
   that renders the cached text plus a "reconnect to edit" banner.

That ships standalone, takes the user from "broken when offline" to
"can read" without committing to any of the bigger sync decisions.
After that we have data on which pads people actually care about
offline-editing and the v2.1 design gets sharper.
