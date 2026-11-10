import { draftKey, maybeApplyDraft } from "./overrideDrafts";
import type { OverrideDraft, OverrideDrafts } from "./overrideDrafts";
import type { DisplayPrinting } from "./printings";
import type { Printing } from "./types";

// "none": no draft.
// "changed": a draft over a printing that is in the master data.
// "added": a version that only exists as a draft so far.
// "pending": a version added during this visit that is waiting for an artwork to be chosen. It isn't saved anywhere.
export type DraftKind = "none" | "changed" | "added" | "pending";

export type PendingVersion = {
  rarity: string;
  variant: number;
};

export type PrintingRow = {
  printing: DisplayPrinting;
  draftKind: DraftKind;
};

// Versions that only exist as drafts have no printing_id yet.
function printingFromDraft(draft: OverrideDraft): DisplayPrinting {
  return {
    printing_id: null,
    rarity: draft.rarity,
    variant: draft.variant,
    artwork: draft.artwork,
    label: draft.label,
    verified: true,
  };
}

function printingFromPending(pending: PendingVersion): DisplayPrinting {
  return {
    printing_id: null,
    rarity: pending.rarity,
    variant: pending.variant,
    artwork: null,
    label: null,
    verified: false,
  };
}

// A setcode's printings as the printing page shows them. In edit mode that means with their drafts applied,
// plus the versions that only exist as drafts and the pending ones. Ordered by rarity as in the master data,
// then by variant number.
export function getPrintingRows(
  masterPrintings: Printing[],
  setcodeId: string,
  drafts: OverrideDrafts,
  pendingVersions: PendingVersion[],
  editMode: boolean,
): PrintingRow[] {
  const rows: PrintingRow[] = masterPrintings.map((printing) => {
    const draft = editMode ? drafts[draftKey(setcodeId, printing.rarity, printing.variant)] : undefined;
    return {
      printing: maybeApplyDraft(printing, draft),
      draftKind: draft === undefined ? "none" : "changed",
    };
  });

  if (!editMode) {
    return rows;
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
    rows.push({ printing: printingFromDraft(draft), draftKind: "added" });
  }

  for (const pending of pendingVersions) {
    rows.push({ printing: printingFromPending(pending), draftKind: "pending" });
  }

  rows.sort((a, b) => {
    const byRarity = rarities.indexOf(a.printing.rarity) - rarities.indexOf(b.printing.rarity);
    return byRarity !== 0 ? byRarity : a.printing.variant - b.printing.variant;
  });
  return rows;
}