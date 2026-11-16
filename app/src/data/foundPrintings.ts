import { setNumberCollator, titleCollator } from "./collators";
import { indexBy } from "./recordGroupingHelpers";
import type { Card, CardSet, Edition, MasterData, Printing, SetCode } from "./types";

// A printing from the master data, together with the records it belongs to.
export interface FoundPrinting {
  printing: Printing;
  setcode: SetCode;
  card: Card;
  set: CardSet;
}

// What a record needs to be shown as a printing: a list entry and a binder card both point at one specific printing +
// edition.
export interface PrintingEditionKey {
  printingId: string;
  edition: Edition;
}

// A record as a page shows it (a list entry on a list, a card in a binder's pool). `found` is null when the master data
// has no such printing (for example after the data was rebuilt without it), so the record can still be shown, and
// removed.
export interface RecordWithFoundPrinting<R extends PrintingEditionKey> {
  record: R;
  found: FoundPrinting | null;
}

// Every printing in the master data by printing id, with its setcode, card and set. Built once per data load.
// A setcode whose card or set is missing from the data is left out (and logged), so its printings show up as not found.
export function buildFoundPrintingsById(data: MasterData): Map<string, FoundPrinting> {
  const cardsById = indexBy(data.cards, (card) => card.card_id);
  const setsById = indexBy(data.sets, (set) => set.set_id);

  const foundPrintingsById = new Map<string, FoundPrinting>();
  for (const setcode of data.setcodes) {
    const card = cardsById.get(setcode.card_id);
    const set = setsById.get(setcode.set_id);
    if (card === undefined || set === undefined) {
      console.warn(
        `Setcode "${setcode.setcode_id}" points at a card or set that isn't in the data; its printings can't be shown on lists or in binders`,
      );
      continue;
    }
    for (const printing of setcode.printings) {
      foundPrintingsById.set(printing.printing_id, { printing, setcode, card, set });
    }
  }
  return foundPrintingsById;
}

function compareKeys(a: PrintingEditionKey, b: PrintingEditionKey): number {
  return titleCollator.compare(a.printingId, b.printingId) || titleCollator.compare(a.edition, b.edition);
}

// By card title, then set number. Records the master data doesn't know go last.
function compareRows<R extends PrintingEditionKey>(a: RecordWithFoundPrinting<R>, b: RecordWithFoundPrinting<R>): number {
  if (a.found === null || b.found === null) {
    if (a.found !== null) {
      return -1;
    }
    if (b.found !== null) {
      return 1;
    }
    return compareKeys(a.record, b.record);
  }
  return (
    titleCollator.compare(a.found.card.title, b.found.card.title) ||
    setNumberCollator.compare(a.found.setcode.set_number, b.found.setcode.set_number) ||
    compareKeys(a.record, b.record)
  );
}

// Joins records to the master data (by printing id) and sorts them for showing. Returns a new array. Records that
// compare equal (copies of the same printing + edition) keep the order they were given in.
export function joinRecordsWithMasterData<R extends PrintingEditionKey>(
  records: readonly R[],
  foundPrintingsById: ReadonlyMap<string, FoundPrinting>,
): RecordWithFoundPrinting<R>[] {
  return records
    .map((record): RecordWithFoundPrinting<R> => ({ record, found: foundPrintingsById.get(record.printingId) ?? null }))
    .sort(compareRows);
}