// What a link leaves in the history entry so the next page can offer a Back link that
// says where it leads. This file is the only place that knows the shape.
export interface BackState {
  // The name of the page the visitor came from
  backLabel: string;
  // That page's address including its query string
  backTo: string;
}

export function makeBackState(backLabel: string, backTo: string): BackState {
  return { backLabel, backTo };
}

// What the previous page left, or null if we arrived without it
// (typed address, bookmark, new tab, or a plain <Link>).
export function readBackState(state: unknown): BackState | null {
  if (typeof state !== "object" || state === null) {
    return null;
  }
  const { backLabel, backTo } = state as Partial<BackState>;
  if (typeof backLabel !== "string" || typeof backTo !== "string") {
    return null;
  }
  return { backLabel, backTo };
}