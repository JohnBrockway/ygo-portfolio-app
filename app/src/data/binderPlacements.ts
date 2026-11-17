import { getPageNumber } from "./binderSpreads";
import type { BinderCardRecord, BinderRecord, SlotPlacement } from "./bindersDb";
import { editionLabel } from "./editions";
import type { RecordWithFoundPrinting } from "./foundPrintings";
import { printingName } from "./printings";

// Pure helpers for the cards of a binder and where they sit. They only read; changing a card's place is binders.ts.

// A card of a binder together with what the master data knows about its printing.
export type BinderCardWithPrinting = RecordWithFoundPrinting<BinderCardRecord>;

// The cards that sit in slots of one page, by slot index (counting from 0, as in SlotPlacement).
export type PlacedCardsBySlotIndex = ReadonlyMap<number, BinderCardWithPrinting>;

// The cards that sit in slots, by the id of the page they are on. Pages without a card have no entry.
export type PlacedCardsByPageId = ReadonlyMap<string, PlacedCardsBySlotIndex>;

const NO_PLACED_CARDS: PlacedCardsBySlotIndex = new Map();

// Groups the cards that are in a slot by page and slot. Unplaced cards are left out. Every slot holds at most one card
// (the database layer keeps it so), so a second card in the same slot is a mistake somewhere else and throws.
export function groupPlacedCardsByPage(cards: readonly BinderCardWithPrinting[]): PlacedCardsByPageId {
  const placedCardsByPageId = new Map<string, Map<number, BinderCardWithPrinting>>();

  for (const card of cards) {
    const placement = card.record.placement;
    if (placement === null) {
      continue;
    }

    let placedCardsOnPage = placedCardsByPageId.get(placement.pageId);
    if (placedCardsOnPage === undefined) {
      placedCardsOnPage = new Map();
      placedCardsByPageId.set(placement.pageId, placedCardsOnPage);
    }
    if (placedCardsOnPage.has(placement.slotIndex)) {
      throw new Error(`More than one card is in slot ${placement.slotIndex} of page "${placement.pageId}"`);
    }
    placedCardsOnPage.set(placement.slotIndex, card);
  }

  return placedCardsByPageId;
}

// The placed cards of one page: empty for a page that has none.
export function getPlacedCardsOnPage(placedCardsByPageId: PlacedCardsByPageId, pageId: string): PlacedCardsBySlotIndex {
  return placedCardsByPageId.get(pageId) ?? NO_PLACED_CARDS;
}

// The name of a card. A card whose printing isn't in the master data is named by its printing id.
export function getBinderCardName(card: BinderCardWithPrinting): string {
  const { record, found } = card;
  return found === null ? record.printingId : found.card.title;
}

// Which printing and edition a card is, e.g. "Secret Rare · 1st Edition" (the same wording as on the tiles). A card whose
// printing isn't in the master data only has its edition.
export function describeBinderCardPrinting(card: BinderCardWithPrinting): string {
  const { record, found } = card;
  const edition = editionLabel(record.edition);
  if (found === null) {
    return edition;
  }
  return `${printingName(found.printing, found.setcode.printings)} · ${edition}`;
}

// Names a card for people on one line (labels, tooltips), e.g. "Dark Magician · Secret Rare · 1st Edition".
export function describeBinderCard(card: BinderCardWithPrinting): string {
  return `${getBinderCardName(card)} · ${describeBinderCardPrinting(card)}`;
}

// Where a card sits, for people, e.g. "Page 2, slot 3". Slots are numbered from 1, like on the page.
export function describePlacement(binder: BinderRecord, placement: SlotPlacement): string {
  return `Page ${getPageNumber(binder.pageIds, placement.pageId)}, slot ${placement.slotIndex + 1}`;
}