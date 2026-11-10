import type { Printing } from "./types";

// A printing as the printing page shows it. printing_id is null for a version that only exists as an edit mode
// draft: the build hasn't given it an id yet, so nothing (marks, later) can be saved against it.
export type DisplayPrinting = Omit<Printing, "printing_id"> & { printing_id: string | null };

// A label as it is shown and saved: with the spaces around it removed, or null if nothing is left.
// Edit mode keeps labels exactly as typed (so spaces can be typed), so anything that shows or saves a label
// goes through this.
export function cleanLabel(label: string | null): string | null {
  if (label === null) {
    return null;
  }
  const trimmed = label.trim();
  return trimmed === "" ? null : trimmed;
}

// What to call a printing in the UI. Normally, just its rarity. When the setcode has several
// printings of that rarity, the artwork tells them apart. A custom label, if present, is always added.
export function printingName(printing: DisplayPrinting, setcodePrintings: DisplayPrinting[]): string {
  const sameRarityCount = setcodePrintings.filter((other) => other.rarity === printing.rarity).length;

  const details: string[] = [];
  if (sameRarityCount > 1 && printing.artwork !== null) {
    details.push(`art ${printing.artwork}`);
  }

  const label = cleanLabel(printing.label);
  if (label !== null) {
    details.push(label);
  }

  if (details.length === 0) {
    return printing.rarity;
  } else {
    return `${printing.rarity} (${details.join(", ")})`;
  }
}