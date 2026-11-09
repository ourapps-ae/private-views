import { viewFor, viewerOf, type Policy } from "../implementation/server/private-views.ts";

type Table = { phase: string; deck: string[]; players: { id: string; name: string; cards: string[]; shown: number[] }[] };
type TableView = Table & { you: string; display: boolean };

// A card table: hold cards are private to their owner until shown, the deck is never sent.
export const tablePolicy: Policy<Table, TableView> = {
  rules: [
    { at: "deck", conceal: "remove" },
    { at: "players[].cards", elements: true, reveal: [{ kind: "owner" }, { kind: "listedIndexes", field: "shown" }] },
  ],
  youField: "you",
  displayField: "display",
};

// What the room sends down each connection.
export function messagesFor(state: Table, connections: { connection: string; role: "participant" | "spectator" | "display"; id: string | null }[]) {
  return Object.fromEntries(connections.map((c) => [c.connection, viewFor(state, viewerOf(c.role, c.id), tablePolicy)]));
}
