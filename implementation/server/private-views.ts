// Send each viewer only what they may see. A policy lists the hidden fields, who may see them and
// when. `viewFor(state, viewer, policy)` returns a copy of the state with everything the viewer may
// not see concealed; the state itself is never changed. Poker-free: a hand of cards, a secret
// note or a hidden score are all "a field of an item owned by someone".
export type Role = "participant" | "spectator" | "display";
export type Viewer = { id: string | null; role: Role };
export type Reveal =
  // The viewer is a participant and owns the item (item[owner] equals the viewer's id).
  | { kind: "owner" }
  // The viewer's role is listed (an empty list reveals to nobody).
  | { kind: "roles"; roles: Role[] }
  // For an element of an array field: the element's index is listed in item[field] (cards shown).
  | { kind: "listedIndexes"; field: string }
  // item[field] is truthy, or equals `equals` when given.
  | { kind: "flag"; field: string; equals?: unknown }
  // A named condition of the policy returns true.
  | { kind: "when"; condition: string };
export type Conceal = "null" | "remove" | "mask";
export type Rule = {
  // "players[].cards": field `cards` of every item of the array `players`; "deck": a field of the state.
  at: string;
  // The item field naming its owner, default "id".
  owner?: string;
  // The field is an array: decide and conceal each element on its own.
  elements?: boolean;
  conceal?: Conceal;
  mask?: unknown;
  // Visible when any of these holds; none listed means never visible.
  reveal?: Reveal[];
};
export type ConditionContext<S> = { state: S; viewer: Viewer; item: unknown; index: number | null };
export type Policy<S, V = S> = {
  rules: Rule[];
  conditions?: { [name: string]: (context: ConditionContext<S>) => boolean };
  // Build the full view from the state first (with hidden data in it); the rules then conceal it.
  project?: (state: S) => V;
  // Set these view fields: `you` to the viewer's id ("" for none), `display` to whether the viewer is a display.
  youField?: string;
  displayField?: string;
  // Add what only this viewer gets (legal actions, a prompt) after concealing.
  decorate?: (view: V, state: S, viewer: Viewer) => V;
};

type Json = { [key: string]: unknown };

export function viewFor<S, V = S>(state: S, viewer: Viewer, policy: Policy<S, V>): V {
  const source = (policy.project ? policy.project(state) : state) as unknown;
  // `visible` looks at the untouched source; `view` is the copy being concealed.
  const view = structuredClone(source) as Json;
  for (const rule of policy.rules) apply(source as Json, view, rule, state, viewer, policy);
  if (policy.youField) view[policy.youField] = viewer.id ?? "";
  if (policy.displayField) view[policy.displayField] = viewer.role === "display";
  return policy.decorate ? policy.decorate(view as unknown as V, state, viewer) : (view as unknown as V);
}

function apply<S, V>(source: Json, view: Json, rule: Rule, state: S, viewer: Viewer, policy: Policy<S, V>) {
  const split = rule.at.indexOf("[].");
  if (split < 0) {
    const path = rule.at.split(".");
    const field = path.pop()!;
    const parent = resolve(view, path);
    const original = resolve(source, path);
    if (!isObject(parent) || !isObject(original) || !(field in parent)) return;
    if (!visible(rule, original, null, state, viewer, policy)) conceal(parent, field, rule);
    return;
  }
  const where = rule.at.slice(0, split).split(".").filter(Boolean);
  const field = rule.at.slice(split + 3);
  const items = resolve(view, where);
  const originals = resolve(source, where);
  if (!Array.isArray(items) || !Array.isArray(originals)) return;
  items.forEach((item: unknown, i: number) => {
    const original = originals[i];
    if (!isObject(item) || !isObject(original) || !(field in item)) return;
    const value = item[field];
    if (rule.elements && Array.isArray(value)) {
      const keep = (_: unknown, index: number) => visible(rule, original, index, state, viewer, policy);
      item[field] = rule.conceal === "remove" ? value.filter(keep) : value.map((element, index) => (keep(element, index) ? element : placeholder(rule)));
    } else if (!visible(rule, original, null, state, viewer, policy)) {
      conceal(item, field, rule);
    }
  });
}

function isObject(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolve(root: unknown, path: string[]): unknown {
  let at = root;
  for (const key of path) {
    if (at === null || typeof at !== "object") return undefined;
    at = (at as Json)[key];
  }
  return at;
}

function placeholder(rule: Rule): unknown {
  return rule.conceal === "mask" ? rule.mask : null;
}

function conceal(item: Json, field: string, rule: Rule) {
  if (rule.conceal === "remove") delete item[field];
  else item[field] = placeholder(rule);
}

function visible<S, V>(rule: Rule, item: Json, index: number | null, state: S, viewer: Viewer, policy: Policy<S, V>): boolean {
  return (rule.reveal ?? []).some((reveal) => {
    switch (reveal.kind) {
      case "owner": {
        const owner = item[rule.owner ?? "id"];
        return viewer.role === "participant" && viewer.id !== null && owner === viewer.id;
      }
      case "roles":
        return reveal.roles.includes(viewer.role);
      case "listedIndexes": {
        const listed = item[reveal.field];
        return index !== null && Array.isArray(listed) && listed.includes(index);
      }
      case "flag":
        return reveal.equals === undefined ? Boolean(item[reveal.field]) : item[reveal.field] === reveal.equals;
      case "when":
        return policy.conditions?.[reveal.condition]?.({ state, viewer, item, index }) === true;
    }
  });
}

// The viewer for a request: a display has no id; a spectator has an id but no item of their own.
export function viewerOf(role: Role, id: string | null): Viewer {
  return { role, id: role === "display" ? null : id };
}

// ---- redacting records (the turn engine's form: facts grouped by owner) ----

// What a game hands over per owner. `open` facts everyone sees; `hidden` facts only the owner sees until they are
// revealed; `revealed` names the hidden keys now public: true for the whole value, or for an array value the list
// of indexes shown (the other elements stay hidden).
export type HiddenRecord = {
  ownerId: string | null;
  open: { [key: string]: unknown };
  hidden: { [key: string]: unknown };
  revealed: { [key: string]: true | number[] };
};

// One object per record, in the same order: the open facts, then every hidden key as its value when the viewer owns
// the record or it is revealed, and null otherwise (a revealed index list keeps the listed elements and nulls the
// rest). A null viewer is a display and sees only what is revealed. A record with no owner belongs to nobody. A
// hidden key with the same name as an open one replaces it. Values are copies; the records are not changed.
export function redact(viewerId: string | null, records: readonly HiddenRecord[]): { [key: string]: unknown }[] {
  return records.map((record) => {
    const owns = viewerId !== null && record.ownerId !== null && record.ownerId === viewerId;
    const out: { [key: string]: unknown } = structuredClone(record.open);
    for (const [key, value] of Object.entries(record.hidden)) {
      const shown = record.revealed?.[key];
      if (owns || shown === true) out[key] = structuredClone(value);
      else if (Array.isArray(shown) && Array.isArray(value)) out[key] = value.map((element, index) => (shown.includes(index) ? structuredClone(element) : null));
      else out[key] = null;
    }
    return out;
  });
}
