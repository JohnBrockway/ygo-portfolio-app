import { useSyncExternalStore } from "react";
import { getArtworkImageFile } from "./images";
import type { Card, Printing } from "./types";

const DRAFTS_KEY = "printingOverrideDrafts";

// One manual override made in edit mode that isn't in the pipeline's printing_overrides.json yet.
// The fields match an entry of that file, so exporting is just writing them out.
export interface OverrideDraft {
  setcode_id: string;
  rarity: string;
  variant: number;
  // The card image index, and the image file at that index.
  artwork: string;
  image: string;
  // Free text as typed. Use cleanLabel before showing or exporting.
  label: string | null;
}

// Drafts by draftKey.
export type OverrideDrafts = Record<string, OverrideDraft | undefined>;

// A draft is identified by setcode, rarity and variant number.
// Intentionally distinct from a canonical printing id from the data build pipeline
export function draftKey(setcodeId: string, rarity: string, variant: number): string {
  return JSON.stringify([setcodeId, rarity, variant]);
}

// Drafts are kept in localStorage, so they only exist in the browser (and site address) they were made in.
// localStorage is shared by every open tab, so it is the one source of truth. Components should only ever read
// through useDrafts and change drafts through updateDrafts.
// TODO move to the app's storage once that exists.

// The parsed drafts, kept until the stored text changes. useSyncExternalStore needs getDrafts to return the
// same object for as long as nothing has changed, so the text is only parsed again when it differs.
let cachedText: string | null | undefined;
let cachedDrafts: OverrideDrafts = {};

// Called whenever drafts change in this tab. (Changes made in other tabs arrive as storage events.)
const listeners = new Set<() => void>();

export function getDrafts(): OverrideDrafts {
  let text: string | null;
  try {
    text = window.localStorage.getItem(DRAFTS_KEY);
  } catch {
    // Storage is blocked, so only what this tab has kept in memory is left.
    return cachedDrafts;
  }

  if (text !== cachedText) {
    cachedText = text;
    try {
      cachedDrafts = text === null ? {} : JSON.parse(text);
    } catch {
      cachedDrafts = {};
    }
  }
  return cachedDrafts;
}

export function updateDrafts(change: (current: OverrideDrafts) => OverrideDrafts): void {
  const current = getDrafts();
  const updatedDrafts = change(current);
  if (updatedDrafts === current) {
    return;
  }

  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(updatedDrafts));
  } catch {
    cachedDrafts = updatedDrafts;
  }
  listeners.forEach((listener) => listener());
}

// Calls listener whenever the drafts change, in this tab or in another one. Returns the way to stop.
export function subscribeToDrafts(listener: () => void): () => void {
  listeners.add(listener);

  // A storage event only fires in the *other* tabs that share the storage, never in the one that made the change.
  // A null key means the storage was cleared.
  function handleStorage(event: StorageEvent) {
    if (event.key === DRAFTS_KEY || event.key === null) {
      listener();
    }
  }
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

// The current drafts, re-rendering the component whenever they change.
export function useDrafts(): OverrideDrafts {
  return useSyncExternalStore(subscribeToDrafts, getDrafts);
}

export function withDraft(drafts: OverrideDrafts, key: string, draft: OverrideDraft): OverrideDrafts {
  return { ...drafts, [key]: draft };
}

export function withoutDraft(drafts: OverrideDrafts, key: string): OverrideDrafts {
  const updatedDrafts = { ...drafts };
  delete updatedDrafts[key];
  return updatedDrafts;
}

export function makeDraft(
  card: Card,
  setcodeId: string,
  rarity: string,
  variant: number,
  artwork: string,
  label: string | null,
): OverrideDraft | null {
  const image = getArtworkImageFile(card, artwork);
  if (image === null) {
    return null;
  }
  return { setcode_id: setcodeId, rarity, variant, artwork, image, label };
}

// The printing as it will look once the draft is exported and built into the master data,
// or the printing itself if it has no draft.
export function maybeApplyDraft(printing: Printing, draft: OverrideDraft | undefined): Printing {
  if (draft === undefined) {
    return printing;
  }
  return {
    ...printing,
    artwork: draft.artwork,
    label: draft.label,
    verified: true,
  };
}