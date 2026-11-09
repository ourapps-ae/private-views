import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { redact, viewFor, viewerOf, type HiddenRecord, type Policy, type Viewer } from "../implementation/server/private-views.ts";
import { accept, isNewer, isOwn, matchesMode, newer } from "../implementation/web/views.ts";
import { messagesFor, tablePolicy } from "../examples/consumer.ts";

const state = JSON.parse(readFileSync(new URL("fixtures/state.json", import.meta.url), "utf8"));
const cases = JSON.parse(readFileSync(new URL("fixtures/views.json", import.meta.url), "utf8"));
const ann: Viewer = { id: "p1", role: "participant" };
const bob: Viewer = { id: "p2", role: "participant" };
const spectator: Viewer = { id: "watcher", role: "spectator" };
const display: Viewer = { id: null, role: "display" };

const policy: Policy<any, any> = {
  rules: [
    { at: "deck", conceal: "remove" },
    { at: "table.secret", conceal: "remove" },
    { at: "players[].cards", elements: true, reveal: [{ kind: "owner" }, { kind: "listedIndexes", field: "shown" }, { kind: "flag", field: "faceUp" }] },
    { at: "players[].note", conceal: "remove", reveal: [{ kind: "owner" }] },
    { at: "players[].score", reveal: [{ kind: "owner" }, { kind: "when", condition: "over" }] },
  ],
  conditions: { over: ({ state }) => state.phase === "over" },
  youField: "you",
  displayField: "display",
};
const cardsOf = (view: any, id: string) => view.players.find((p: any) => p.id === id).cards;

test("an owner sees their own cards; others' cards are hidden unless shown or face up", () => {
  const view = viewFor(state, ann, policy);
  assert.deepEqual(cardsOf(view, "p1"), ["As", "Kh"]);
  assert.deepEqual(cardsOf(view, "p2"), [null, "2d"], "one card shown by its owner");
  assert.deepEqual(cardsOf(view, "p3"), ["9h", "9s"], "face up flag shows every card");
});

test("spectators and displays see only public information, a display never counts as an owner", () => {
  for (const viewer of [spectator, display, { id: "p1", role: "display" as const }, { id: "p1", role: "spectator" as const }]) {
    const view = viewFor(state, viewer, policy);
    assert.deepEqual(cardsOf(view, "p1"), [null, null], JSON.stringify(viewer));
    assert.deepEqual(cardsOf(view, "p2"), [null, "2d"]);
  }
  assert.deepEqual(viewerOf("display", "p1"), { id: null, role: "display" });
});

test("hidden fields can be removed, nulled, masked or filtered out of an array", () => {
  const view = viewFor(state, bob, policy);
  assert.equal("deck" in view, false);
  assert.equal("secret" in view.table, false);
  assert.equal(view.table.open, "visible-label");
  assert.equal("note" in view.players[0], false);
  assert.equal(view.players[1].note, "bob-secret-note");
  assert.equal(view.players[0].score, null);
  const masked = viewFor(state, spectator, { rules: [{ at: "players[].cards", elements: true, conceal: "mask", mask: "??", reveal: [{ kind: "listedIndexes", field: "shown" }] }] });
  assert.deepEqual(cardsOf(masked, "p2"), ["??", "2d"]);
  const filtered = viewFor(state, spectator, { rules: [{ at: "players[].cards", elements: true, conceal: "remove", reveal: [{ kind: "listedIndexes", field: "shown" }] }] });
  assert.deepEqual(cardsOf(filtered, "p2"), ["2d"]);
  assert.deepEqual(cardsOf(filtered, "p1"), []);
});

test("reveal conditions open hidden fields to everyone when they hold", () => {
  assert.equal(viewFor(state, spectator, policy).players[1].score, null);
  const over = viewFor({ ...state, phase: "over" }, spectator, policy);
  assert.deepEqual(over.players.map((p: any) => p.score), [10, 20, 30]);
});

test("roles can be given a view of their own, for example a referee spectator but not a display", () => {
  const referee: Policy<any, any> = { rules: [{ at: "players[].cards", elements: true, reveal: [{ kind: "roles", roles: ["spectator"] }] }] };
  assert.deepEqual(cardsOf(viewFor(state, spectator, referee), "p1"), ["As", "Kh"]);
  assert.deepEqual(cardsOf(viewFor(state, display, referee), "p1"), [null, null]);
  assert.deepEqual(cardsOf(viewFor(state, ann, referee), "p1"), [null, null]);
});

test("the view says who it is for and can be decorated per viewer", () => {
  const view = viewFor(state, ann, { ...policy, decorate: (v: any, s: any, viewer: Viewer) => ({ ...v, legal: viewer.id === "p1" && s.phase === "betting" }) });
  assert.equal(view.you, "p1");
  assert.equal(view.display, false);
  assert.equal(view.legal, true);
  const shown = viewFor(state, display, policy);
  assert.deepEqual([shown.you, shown.display], ["", true]);
});

test("a projection is built first and then concealed", () => {
  const projected: Policy<any, any> = {
    project: (s) => ({ roomPhase: s.phase, players: s.players.map((p: any) => ({ id: p.id, cards: p.cards })) }),
    rules: [{ at: "players[].cards", elements: true, reveal: [{ kind: "owner" }] }],
  };
  const view = viewFor(state, bob, projected);
  assert.deepEqual(Object.keys(view).sort(), ["players", "roomPhase"]);
  assert.deepEqual(cardsOf(view, "p2"), ["2c", "2d"]);
  assert.deepEqual(cardsOf(view, "p1"), [null, null]);
});

test("the state is never changed and a rule on a missing field does nothing", () => {
  const copy = structuredClone(state);
  viewFor(state, spectator, { ...policy, rules: [...policy.rules, { at: "nothing.here", conceal: "remove" }, { at: "ghosts[].x", conceal: "remove" }] });
  assert.deepEqual(state, copy);
});

test("no viewer's serialised view contains another participant's hidden values", () => {
  const hidden: Record<string, string[]> = { p1: ["As", "Kh", "ann-secret-note"], p2: ["2c", "bob-secret-note"], p3: [] };
  for (const viewer of [ann, bob, { id: "p3", role: "participant" as const }, spectator, display]) {
    const text = JSON.stringify(viewFor(state, viewer, policy));
    for (const [owner, secrets] of Object.entries(hidden)) {
      if (viewer.id === owner && viewer.role === "participant") continue;
      for (const secret of secrets) assert.equal(text.includes(secret), false, `${viewer.role}/${viewer.id} sees ${secret}`);
    }
    for (const secret of ["Qs", "7d", "dealer-seed-91"]) assert.equal(text.includes(secret), false, secret);
  }
});

test("client keeps the newest view and refuses one meant for another mode", () => {
  for (const c of cases.cases) assert.equal(isNewer({ you: "", ...c.incoming }, c.current && { you: "", ...c.current }), c.newer, c.name);
  for (const m of cases.modes) {
    const view = { roomId: "a", version: 1, you: "", display: m.display };
    assert.equal(matchesMode(view, "player"), m.player);
    assert.equal(matchesMode(view, "display"), m.displayMode);
  }
  const current = { roomId: "a", version: 4, you: "p1" };
  assert.equal(newer({ roomId: "a", version: 3, you: "p1" }, current), current);
  assert.equal(accept({ roomId: "a", version: 5, you: "p1" }, current, "player")?.version, 5);
  assert.equal(accept({ roomId: "a", version: 6, you: "", display: true }, current, "player"), current);
  assert.equal(accept({ roomId: "a", version: 6, you: "p1" }, null, "player")?.version, 6);
  assert.equal(isOwn(current, "p1"), true);
  assert.equal(isOwn({ ...current, you: "" }, ""), false);
});

test("example card table sends each connection its own view", () => {
  const out = messagesFor(state, [
    { connection: "c1", role: "participant", id: "p1" },
    { connection: "c2", role: "spectator", id: "w" },
    { connection: "c3", role: "display", id: null },
  ]) as Record<string, any>;
  assert.deepEqual(cardsOf(out.c1, "p1"), ["As", "Kh"]);
  assert.deepEqual(cardsOf(out.c2, "p1"), [null, null]);
  assert.deepEqual([out.c3.you, out.c3.display, "deck" in out.c3], ["", true, false]);
  assert.equal(tablePolicy.rules.length, 2);
});

// ---- redact: records grouped by owner, the turn engine's form ----

const records = (): HiddenRecord[] => [
  { ownerId: "p1", open: { id: "p1", seat: 0 }, hidden: { cards: ["As", "Kh"], note: "ann-note" }, revealed: {} },
  { ownerId: "p2", open: { id: "p2", seat: 1 }, hidden: { cards: ["2c", "2d"] }, revealed: { cards: [1] } },
  { ownerId: "p3", open: { id: "p3", seat: 2 }, hidden: { cards: ["9h", "9s"], note: "cy-note" }, revealed: { cards: true } },
  { ownerId: null, open: { label: "board" }, hidden: { burned: ["7d"] }, revealed: {} },
];

test("redact: the owner sees their hidden facts, everyone sees open and revealed ones, in record order", () => {
  const out = redact("p1", records());
  assert.deepEqual(out, [
    { id: "p1", seat: 0, cards: ["As", "Kh"], note: "ann-note" },
    { id: "p2", seat: 1, cards: [null, "2d"] },
    { id: "p3", seat: 2, cards: ["9h", "9s"], note: null },
    { label: "board", burned: null },
  ]);
  assert.deepEqual(redact("p2", records())[1], { id: "p2", seat: 1, cards: ["2c", "2d"] }, "the owner sees every element, shown or not");
});

test("redact: a null viewer is a display and sees only what is revealed; a viewer who owns nothing sees the same", () => {
  const display = redact(null, records());
  assert.deepEqual(display, redact("watcher", records()));
  assert.deepEqual(display[0], { id: "p1", seat: 0, cards: null, note: null });
  assert.deepEqual(display[1].cards, [null, "2d"]);
  assert.deepEqual(display[2].cards, ["9h", "9s"]);
  assert.equal(redact(null, [{ ownerId: null, open: {}, hidden: { k: 1 }, revealed: {} }])[0].k, null, "a record with no owner belongs to nobody");
  assert.deepEqual(redact(null, []), []);
});

test("redact: a revealed index list needs an array value, hidden wins over open, nothing is changed or shared", () => {
  const input = records();
  const copy = structuredClone(input);
  const out = redact("p3", input);
  assert.deepEqual(input, copy);
  (out[2].cards as string[])[0] = "changed";
  assert.equal((input[2].hidden.cards as string[])[0], "9h");
  assert.equal(redact(null, [{ ownerId: "a", open: {}, hidden: { score: 5 }, revealed: { score: [0] } }])[0].score, null);
  assert.deepEqual(redact(null, [{ ownerId: "a", open: { k: "open" }, hidden: { k: "secret" }, revealed: { k: true } }])[0], { k: "secret" });
  assert.deepEqual(redact(null, [{ ownerId: "a", open: {}, hidden: { k: "x" } } as never])[0], { k: null }, "a record with no revealed map reveals nothing");
});

test("redact: no viewer's serialised output holds another owner's hidden values", () => {
  for (const viewer of ["p1", "p2", "p3", "watcher", null]) {
    const text = JSON.stringify(redact(viewer, records()));
    if (viewer !== "p1") for (const secret of ["As", "Kh", "ann-note"]) assert.equal(text.includes(secret), false, `${viewer} sees ${secret}`);
    if (viewer !== "p2") assert.equal(text.includes("2c"), false, `${viewer} sees 2c`);
    if (viewer !== "p3") assert.equal(text.includes("cy-note"), false);
    assert.equal(text.includes("7d"), false, "an unowned hidden fact is shown to nobody");
  }
});
