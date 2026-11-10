import type { Printing } from "./types";

// A printing as the printing page shows it. printing_id is null for a version that only exists as an edit mode
// draft: the build hasn't given it an id yet, so nothing (marks, later) can be saved against it.
export type DisplayPrinting = Omit<Printing, "printing_id"> & { printing_id: string | null };

// What to call a printing in the UI. Normally, just its rarity. When the setcode has several
// printings of that rarity, the artwork tells them apart. A custom label, if present, is always added.
export function printingName(printing: DisplayPrinting, setcodePrintings: DisplayPrinting[]): string {
  const sameRarityCount = setcodePrintings.filter((other) => other.rarity === printing.rarity).length;

  const details: string[] = [];
  if (sameRarityCount > 1 && printing.artwork !== null) {
    details.push(`art ${printing.artwork}`);
  }

  // Labels are kept as typed in edit mode, so trim them here; one with only spaces counts as no label.
  const label = printing.label?.trim();
  if (label) {
    details.push(label);
  }

  if (details.length === 0) {
    return printing.rarity;
  } else {
    return `${printing.rarity} (${details.join(", ")})`;
  }
}