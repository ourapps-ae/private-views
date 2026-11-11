# Source mapping

Reference revision: `19905b75dbea89fbfd424d67fe26c81aaed0e018`. Paths are under the `recipe/` folder of `ourapps-ae/OurPoker`.

## Files

- `implementation/server/private-views.ts` <- `server/src/view.ts`:
  - `viewFor(state, viewer, policy)`: generalises `viewFor(game, viewerId, version, roomId, withOdds)` lines 10-53. The recipe's viewer is a player id or null for a display (line 11); here a `Viewer` has an id and a role (participant, spectator, display) and a display never has an id. `you` and `display` (lines 21 and 23) become `youField` and `displayField`.
  - Hidden-card rule: `playerView` lines 65-67, `cards = p.cards.map((c, i) => (visible || p.shown.includes(i) ? c : null))` becomes the rule `{at: "players[].cards", elements: true, reveal: [{kind: "owner"}, {kind: "listedIndexes", field: "shown"}]}`. The recipe's hand evaluation of shown cards (lines 68-70, 91) is poker and is left behind; it would be a `project` function in the game rules.
  - Display view: `legal = {...NONE, show: []}` for a display (line 13) and the display prompt (lines 14, 226) become `decorate`; the rule engine never reveals to a display unless a rule says so.
  - Hidden state not sent: the deck and the engine's internals are absent from the recipe's `View` type because `viewFor` builds the view field by field (lines 16-52); a `project` function and `conceal: "remove"` rules express that.
  - Rule matching, reveal kinds `roles`, `flag` and `when`, `mask` and `remove` concealment, `viewerOf`: new (`generated-platform`); the recipe has the owner and shown-card rules only.
  - Left behind: legal actions and prompts (`legalFor` lines 177-219, `promptFor` lines 223-264), phases (`phaseOf`, lines 55-63), hand, pot, clock and history views (lines 101-156), odds. All poker; they belong to holdem-rules and turn-engine.
  - `redact` and `HiddenRecord` (`generated-adapter`): written to `interfaces/required-private-views.json` in `ourapps-ae/turn-engine`. Same rule as the recipe's hidden-card line (`view.ts:65-67`: a card is shown when its owner is the viewer or its index is in `shown`) over records instead of the whole state: `ownerId` equals the viewer's id, `revealed[key] === true` for a whole value, a number list for the shown elements of an array; a display (null viewer) sees only revealed facts as at `view.ts:13`.
- `implementation/web/views.ts` <- `web/src/store.ts` lines 299-303 (`newer`), 290 (`(mode === "board") !== Boolean(incoming.display)`), and the view type in `web/src/api.ts` lines 38-45 (`version`, `roomId`, `you`, `display`).
- `implementation/apple/Sources/PrivateViews.swift` <- `ios/OurPoker/Sources/TableModel.swift` lines 342-347 (`newer`) and 306 (`v.isDisplay == display`), `Model.swift` lines 220-257 (`GameView`: `version`, `roomId`, `you`, `display`, `isDisplay`).
- `implementation/android/src/main/java/ae/views/PrivateViews.kt` <- `android/app/src/main/java/app/ourapps/ourpoker/TableViewModel.kt` lines 491-493 (`newer`), `net/Model.kt` lines 159-190 (`View`). Not compiled on the authoring machine (no kotlinc).

## Left behind in the recipe

The poker view types themselves (`PlayerView`, `HandView`, `Legal`, `OddsRow` and the rest of `web/src/api.ts` lines 11-45, `Model.swift`, `net/Model.kt`): only the generic envelope is extracted.
