import type { EntryRecord } from "./listsDb";
import type { Card, CardSet, MasterData, Printing, SetCode } from "./types";

// A printing from the master data, together with the records it belongs to.
export interface FoundPrinting {
  printing: Printing;
  setcode: SetCode;
  card: Card;
  set: CardSet;
}

// A list entry as the list page shows it. `found` is null when the master data has no such printing (for example
// after the data was rebuilt without it), so the entry can still be shown, and removed.
export interface ListEntry {
  entry: EntryRecord;
  found: FoundPrinting | null;
}

const titleCollator = new Intl.Collator();
const setNumberCollator = new Intl.Collator(undefined, { numeric: true });

// Every printing in the master data by printing id, with its setcode, card and set. Built once per data load.
// A setcode whose card or set is missing from the data is left out (and logged), so its printings show up as not found.
export function buildFoundPrintingsById(data: MasterData): Map<string, FoundPrinting> {
  const cardsById = new Map(data.cards.map((card): [string, Card] => [card.card_id, card]));
  const setsById = new Map(data.sets.map((set): [string, CardSet] => [set.set_id, set]));

  const foundPrintingsById = new Map<string, FoundPrinting>();
  for (const setcode of data.setcodes) {
    const card = cardsById.get(setcode.card_id);
    const set = setsById.get(setcode.set_id);
    if (card === undefined || set === undefined) {
      console.warn(
        `Setcode "${setcode.setcode_id}" points at a card or set that isn't in the data; its printings can't be shown on lists`,
      );
      continue;
    }
    for (const printing of setcode.printings) {
      foundPrintingsById.set(printing.printing_id, { printing, setcode, card, set });
    }
  }
  return foundPrintingsById;
}

function compareEntryKeys(a: EntryRecord, b: EntryRecord): number {
  return titleCollator.compare(a.printingId, b.printingId) || titleCollator.compare(a.edition, b.edition);
}

// By card title, then set number. Entries the master data doesn't know go last.
function compareRows(a: ListEntry, b: ListEntry): number {
  if (a.found === null || b.found === null) {
    if (a.found !== null) {
      return -1;
    }
    if (b.found !== null) {
      return 1;
    }
    return compareEntryKeys(a.entry, b.entry);
  }
  return (
    titleCollator.compare(a.found.card.title, b.found.card.title) ||
    setNumberCollator.compare(a.found.setcode.set_number, b.found.setcode.set_number) ||
    compareEntryKeys(a.entry, b.entry)
  );
}

// Joins list entries to the master data (by printing id) and sorts them for showing. Returns a new array.
export function joinEntriesWithMasterData(
  entries: readonly EntryRecord[],
  foundPrintingsById: ReadonlyMap<string, FoundPrinting>,
): ListEntry[] {
  return entries
    .map((entry): ListEntry => ({ entry, found: foundPrintingsById.get(entry.printingId) ?? null }))
    .sort(compareRows);
}