import type { Printing } from "./types";

// What to call a printing in the UI. Normally, just its rarity. When the setcode has several
// printings of that rarity, the artwork tells them apart. A custom label, if present, is always added.
export function printingName(printing: Printing, setcodePrintings: Printing[]): string {
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