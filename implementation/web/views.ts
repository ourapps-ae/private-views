// The client side of private views: what every view carries, and which arriving view to keep.
export type ViewEnvelope = { version: number; roomId: string; you: string; display?: boolean };
export type ClientMode = "player" | "display";

// A view replaces the current one only when it is from another room or has a higher version:
// an action's reply and the pushed view can arrive in either order.
export function isNewer(incoming: ViewEnvelope, current: ViewEnvelope | null): boolean {
  return current === null || current.roomId !== incoming.roomId || incoming.version > current.version;
}

export function newer<V extends ViewEnvelope>(incoming: V, current: V | null): V {
  return isNewer(incoming, current) ? incoming : (current as V);
}

// A player's connection must only be given player views and a display's only public ones.
export function matchesMode(view: ViewEnvelope, mode: ClientMode): boolean {
  return (mode === "display") === Boolean(view.display);
}

// The view to show after one arrives, or the current one when the arrival is stale or for the wrong mode.
export function accept<V extends ViewEnvelope>(incoming: V, current: V | null, mode: ClientMode): V | null {
  return matchesMode(incoming, mode) ? newer(incoming, current) : current;
}

export function isOwn(view: ViewEnvelope, id: string): boolean {
  return view.you !== "" && view.you === id;
}
