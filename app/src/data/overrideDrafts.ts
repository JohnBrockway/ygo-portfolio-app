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
// TODO move to the app's storage once that exists.

export function loadDrafts(): OverrideDrafts {
  try {
    const text = window.localStorage.getItem(DRAFTS_KEY);
    return text === null ? {} : JSON.parse(text);
  } catch {
    // Storage is blocked or holds something unreadable.
    return {};
  }
}

export function saveDraftsToStorage(drafts: OverrideDrafts): void {
  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // Storage is blocked, so the drafts can't be remembered. Nothing else to do.
  }
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
  const image = card.images.find((candidate) => candidate.index === artwork);
  if (image === undefined || image.file === null) {
    return null;
  }
  return { setcode_id: setcodeId, rarity, variant, artwork, image: image.file, label };
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