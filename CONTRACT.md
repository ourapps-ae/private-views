# Private views component

## Purpose and facilities
`private-views` makes the one thing every shared activity with secrets needs: a function `viewFor(state, viewer, policy)` that returns what one viewer may see. The policy lists hidden fields (`players[].cards`, `deck`, `table.secret`), who may see each one (its owner, listed roles, listed array positions, a flag on the item, or a named condition of the policy) and how it is concealed (set to null, removed or masked; per element for arrays). Viewers are participants, spectators and displays; a display never has an id, so it can never count as an owner. The state is never changed. The same component carries the small client side: the envelope every view has (version, room, who it is for, whether it is a display) and the rule for which arriving view to keep. Records grouped by owner (a game's per-player hidden facts) are redacted by `redact(viewerId, records)`, the form the turn engine uses.

Facilities: `private-views` (Policy-driven per-viewer redaction and client view helpers).

## User inputs
No installer settings. The policy is supplied by the application or by the component that owns the state (for example the game rules component).

## Artefacts and dependencies
`component.json` maps every `implementation/` source into `components/private-views/`:

- `implementation/android/src/main/java/ae/views/PrivateViews.kt` -> `components/private-views/android/src/main/java/ae/views/PrivateViews.kt`
- `implementation/apple/Sources/PrivateViews.swift` -> `components/private-views/apple/Sources/PrivateViews.swift`
- `implementation/server/private-views.ts` -> `components/private-views/server/private-views.ts`
- `implementation/web/views.ts` -> `components/private-views/web/views.ts`

Dependencies: none.
`tools.lock.json` pins verification tools: node 26.5.0, python3 3.12.8, swiftc 6.4.2, kotlinc 2.2.0, java 26.0.1. Licence wording remains deferred.

## Provided interfaces
- `interfaces/private-views.json` defines `private-views` (ae/private-views) version 1.0.0 as an OpenRPC 1.3.2 document: one method per function, tagged with the languages that provide it (`typescript`, `swift`, `kotlin`), with the policy, rules, viewer, view envelope and hidden records as JSON Schema 2020-12.

## Required interfaces
None.

## Integration
Server: define one `Policy` for the state type and call `viewFor(state, viewerOf(role, id), policy)` once per connection when the state changes; send each connection its own result. Use `project` to build the view shape from the state, `decorate` to add what only this viewer gets (legal actions, a prompt), and `youField` and `displayField` to tell the client who it is. Clients: `accept(incoming, current, mode)` (web) or `PrivateViews.isNewer` and `matchesMode` (Apple) and `isNewer` and `matchesMode` (Android) keep the newest view and refuse a player view on a display connection and the reverse. `examples/consumer.ts` shows a card table. The turn-engine uses this component through its `private-views` requirement. `redact(viewerId, records)` (server) is the record form: each `HiddenRecord` has an owner, open facts everyone sees, hidden facts only the owner sees, and a `revealed` map naming hidden keys now public (`true`, or the indexes of an array); a null viewer is a display and sees only revealed facts.

## Visual definition and connected examples
`visual/definition.json` maps its ports to the provided and required interfaces. `visual/examples/connected.json` connects the component to an illustrative application consumer. Both image formats and a text description are in `visual/output/`.

## Infrastructure
No service. Pure functions.

## Verification
Required-local: `node --test tests/web.test.ts` checks owners, spectators and displays, removal, nulling, masking and filtering of hidden fields, reveal by listed positions, flags and conditions, roles, projection, decoration, that the state is unchanged, a scan that no viewer's serialised view contains another participant's secrets, `redact` (owner, other viewer, display, revealed index lists, copies, a no-leak scan over every viewer), the client's newest-view and mode rules and the example. Platform: `python3 tests/native.py apple` compiles and runs the Swift envelope checks against `tests/fixtures/views.json`; `python3 tests/native.py android` compiles the Kotlin checks (needs kotlinc, not installed on the authoring machine, so not run there).

- `node --test tests/web.test.ts` (web, required-local; tools: node 26.5.0)
- `python3 tests/native.py apple` (apple, platform; tools: python3 3.12.8, swiftc 6.4.2)
- `python3 tests/native.py android` (android, platform; tools: python3 3.12.8, kotlinc 2.2.0, java 26.0.1)

## Scenarios and presentation
A card table sends Ann her own cards and face-down placeholders for Bob's, except the card Bob has shown. A spectator and a table display see the same public view, and a display whose connection carries a participant id still sees nothing private. At the end of a round a condition reveals every score to everyone. A late reply to an action arrives after a newer pushed view and is ignored.

## Updates and removal
Patch updates replace files; no persisted-state migration. A policy change is a change to what leaves the server, so applications should re-run their no-leak test (the scan in this component's tests is a model) after changing one.
