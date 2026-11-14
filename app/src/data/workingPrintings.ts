import { draftKey, maybeApplyDraft } from "./overrideDrafts";
import type { OverrideDraft, OverrideDrafts } from "./overrideDrafts";
import type { Printing } from "./types";

// "none": no draft.
// "changed": a draft over a printing that is in the master data.
// "added": a printing that only exists as a draft so far.
// "pending": a printing added during this visit that is waiting for an artwork to be chosen. It isn't saved anywhere.
export type DraftKind = "none" | "changed" | "added" | "pending";

// A printing as it currently stands: the master data's printing with its edit mode draft applied, or one that
// only exists as a draft or is still pending. printing_id is null for the latter two: the build hasn't given them
// an id yet, so nothing (marks, later) can be saved against them. draft_kind says which of these it is.
export type WorkingPrinting = Omit<Printing, "printing_id"> & {
  printing_id: string | null;
  draft_kind: DraftKind;
};

// Printings that only exist as drafts have no printing_id yet.
function createAddedPrinting(draft: OverrideDraft): WorkingPrinting {
  return {
    printing_id: null,
    rarity: draft.rarity,
    variant: draft.variant,
    artwork: draft.artwork,
    label: draft.label,
    verified: true,
    draft_kind: "added",
  };
}

export function createPendingPrinting(rarity: string, variant: number): WorkingPrinting {
  return {
    printing_id: null,
    rarity,
    variant,
    artwork: null,
    label: null,
    verified: false,
    draft_kind: "pending",
  };
}

// A setcode's printings as they currently stand. In edit mode that means with their drafts applied,
// plus the printings that only exist as drafts and the pending ones. Ordered by rarity as in the master data,
// then by variant number.
export function getWorkingPrintings(
  masterPrintings: Printing[],
  setcodeId: string,
  drafts: OverrideDrafts,
  pendingPrintings: WorkingPrinting[],
  editMode: boolean,
): WorkingPrinting[] {
  const workingPrintings: WorkingPrinting[] = masterPrintings.map((printing) => {
    const draft = editMode ? drafts[draftKey(setcodeId, printing.rarity, printing.variant)] : undefined;
    return {
      ...maybeApplyDraft(printing, draft),
      draft_kind: draft === undefined ? "none" : "changed",
    };
  });

  if (!editMode) {
    return workingPrintings;
  }

  const masterKeys = new Set(masterPrintings.map((printing) => draftKey(setcodeId, printing.rarity, printing.variant)));
  // The card's rarities in this set, in the order the master data lists them.
  const rarities = [...new Set(masterPrintings.map((printing) => printing.rarity))];

  for (const draft of Object.values(drafts)) {
    if (draft === undefined || draft.setcode_id !== setcodeId) {
      continue;
    }
    if (masterKeys.has(draftKey(draft.setcode_id, draft.rarity, draft.variant))) {
      continue;
    }
    // A draft for a rarity this setcode no longer has is stale, so it isn't shown.
    if (!rarities.includes(draft.rarity)) {
      continue;
    }
    workingPrintings.push(createAddedPrinting(draft));
  }

  workingPrintings.push(...pendingPrintings);

  workingPrintings.sort((a, b) => {
    const byRarity = rarities.indexOf(a.rarity) - rarities.indexOf(b.rarity);
    return byRarity !== 0 ? byRarity : a.variant - b.variant;
  });
  return workingPrintings;
}