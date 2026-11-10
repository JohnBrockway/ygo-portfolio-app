import { getArtworkImageFile } from "./images";
import { draftKey, withoutDraft } from "./overrideDrafts";
import type { OverrideDraft, OverrideDrafts } from "./overrideDrafts";
import { cleanLabel } from "./printings";
import type { MasterData } from "./types";

export type OverrideBuild = {
  // Every override the exported file will hold, in the file's order.
  entries: OverrideDraft[];
  // How many of them are already in the master data, and how many come from drafts.
  fromData: number;
  fromDrafts: number;
  // Issues blocking export.
  problems: string[];
  // Drafts left out of the export because what they refer to no longer exists.
  warnings: string[];
};

function indexBy<T>(items: T[], getKey: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(getKey(item), item);
  }
  return map;
}

function compareEntries(a: OverrideDraft, b: OverrideDraft): number {
  const bySetcode = a.setcode_id.localeCompare(b.setcode_id);
  if (bySetcode !== 0) {
    return bySetcode;
  }
  const byRarity = a.rarity.localeCompare(b.rarity);
  if (byRarity !== 0) {
    return byRarity;
  }
  return a.variant - b.variant;
}

// The overrides the exported file will hold: any printings in the master data marked as "verified" (each one has an override
// behind it), with the drafts applied on top, checked against what the build would reject.
export function buildOverrides(data: MasterData, drafts: OverrideDrafts): OverrideBuild {
  const cardsById = indexBy(data.cards, (card) => card.card_id);
  const setcodesById = indexBy(data.setcodes, (setcode) => setcode.setcode_id);
  const problems: string[] = [];
  const warnings: string[] = [];
  // The overrides by draftKey, and whether each one comes from a draft.
  const found = new Map<string, { entry: OverrideDraft; fromDraft: boolean }>();

  // The file of the card's image with this artwork index, or null if there isn't one.
  function findArtworkFile(cardId: string, artwork: string): string | null {
    const card = cardsById.get(cardId);
    return card === undefined ? null : getArtworkImageFile(card, artwork);
  }

  // What to call a printing in the messages.
  function describe(setcodeId: string, rarity: string, variant: number): string {
    const setcode = setcodesById.get(setcodeId);
    if (setcode === undefined) {
      return `${setcodeId}, ${rarity}, version ${variant}`;
    }
    const card = cardsById.get(setcode.card_id);
    const cardTitle = card === undefined ? setcode.card_id : card.title;
    return `${cardTitle}, ${setcode.set_number}, ${rarity}, version ${variant}`;
  }

  // The overrides already in the master data: its verified printings.
  for (const setcode of data.setcodes) {
    for (const printing of setcode.printings) {
      if (!printing.verified || printing.artwork === null) {
        continue;
      }
      const image = findArtworkFile(setcode.card_id, printing.artwork);
      if (image === null) {
        const description = describe(setcode.setcode_id, printing.rarity, printing.variant);
        problems.push(`${description}: art ${printing.artwork} isn't an available image of the card.`);
        continue;
      }
      found.set(draftKey(setcode.setcode_id, printing.rarity, printing.variant), {
        entry: {
          setcode_id: setcode.setcode_id,
          rarity: printing.rarity,
          variant: printing.variant,
          artwork: printing.artwork,
          image,
          label: printing.label,
        },
        fromDraft: false,
      });
    }
  }

  // The drafts, which replace the master data's override for the same printing or add a new one.
  for (const draft of Object.values(drafts)) {
    if (draft === undefined) {
      continue;
    }

    const description = describe(draft.setcode_id, draft.rarity, draft.variant);
    const setcode = setcodesById.get(draft.setcode_id);
    if (setcode === undefined || !setcode.printings.some((printing) => printing.rarity === draft.rarity)) {
      warnings.push(`Left out: a draft for ${description}, which no longer exists in the data.`);
      continue;
    }

    const image = findArtworkFile(setcode.card_id, draft.artwork);
    if (image === null) {
      problems.push(`${description}: art ${draft.artwork} is no longer an available image of the card.`);
      continue;
    }
    if (image !== draft.image) {
      problems.push(
        `${description}: art ${draft.artwork} is now a different image than when you tagged it. Pick the artwork again.`,
      );
      continue;
    }

    found.set(draftKey(draft.setcode_id, draft.rarity, draft.variant), {
      entry: {
        setcode_id: draft.setcode_id,
        rarity: draft.rarity,
        variant: draft.variant,
        artwork: draft.artwork,
        image: draft.image,
        label: cleanLabel(draft.label),
      },
      fromDraft: true,
    });
  }

  const sorted = [...found.values()].sort((a, b) => compareEntries(a.entry, b.entry));
  const entries = sorted.map((item) => item.entry);

  // Two versions of a rarity with the same artwork need at least different labels (the build rejects them otherwise).
  const seenLooks = new Map<string, OverrideDraft>();
  for (const entry of entries) {
    const look = JSON.stringify([entry.setcode_id, entry.rarity, entry.artwork, entry.label]);
    const other = seenLooks.get(look);
    if (other === undefined) {
      seenLooks.set(look, entry);
      continue;
    }
    const labelText = entry.label === null ? "no label" : `the label “${entry.label}”`;
    const description = describe(entry.setcode_id, entry.rarity, entry.variant);
    problems.push(
      `${description}: versions ${other.variant} and ${entry.variant} both show art ${entry.artwork} with ${labelText}. Give them different labels or different art.`,
    );
  }

  return {
    entries,
    fromData: sorted.filter((item) => !item.fromDraft).length,
    fromDrafts: sorted.filter((item) => item.fromDraft).length,
    problems,
    warnings,
  };
}

// The drafts without the ones the master data already contains (what is left once the exported file has been built).
export function dropRedundantDrafts(data: MasterData, drafts: OverrideDrafts): OverrideDrafts {
  const setcodesById = indexBy(data.setcodes, (setcode) => setcode.setcode_id);

  let remainingDrafts = drafts;
  for (const [key, draft] of Object.entries(drafts)) {
    if (draft === undefined) {
      continue;
    }
    const setcode = setcodesById.get(draft.setcode_id);
    if (setcode === undefined) {
      continue;
    }
    const printing = setcode.printings.find(
      (candidate) => candidate.rarity === draft.rarity && candidate.variant === draft.variant,
    );
    if (
      printing !== undefined &&
      printing.verified &&
      printing.artwork === draft.artwork &&
      printing.label === cleanLabel(draft.label)
    ) {
      remainingDrafts = withoutDraft(remainingDrafts, key);
    }
  }
  return remainingDrafts;
}

// The text of printing_overrides.json: one entry per line, so changes show up clearly in a diff.
export function formatOverrideFile(entries: OverrideDraft[]): string {
  if (entries.length === 0) {
    return "[]\n";
  }
  const lines = entries.map((entry) => `  ${JSON.stringify(entry)}`);
  return `[\n${lines.join(",\n")}\n]\n`;
}