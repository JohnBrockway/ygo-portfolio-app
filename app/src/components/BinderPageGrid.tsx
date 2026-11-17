import type { BinderCardWithPrinting, PlacedCardsBySlotIndex } from "../data/binderPlacements";
import { BinderSlot } from "./BinderSlot";

// One page of a binder: a grid of slots, each empty or showing the card placed in it. Slots are numbered from 1, row by
// row (slotIndex in the data counts from 0).
export function BinderPageGrid({
  columns,
  rows,
  pageNumber,
  placedCards,
  selectedCard,
  slotChangesDisabled,
  onSlotClick,
}: {
  columns: number;
  rows: number;
  pageNumber: number;
  placedCards: PlacedCardsBySlotIndex;
  // The card that is picked up, wherever it is, or null.
  selectedCard: BinderCardWithPrinting | null;
  slotChangesDisabled: boolean;
  onSlotClick: (slotIndex: number) => void;
}) {
  const slotIndexes = Array.from({ length: columns * rows }, (_, slotIndex) => slotIndex);

  return (
    <ol
      className="binder-page"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-label={`Page ${pageNumber}`}
    >
      {slotIndexes.map((slotIndex) => {
        const placedCard = placedCards.get(slotIndex) ?? null;

        let isSelected = false;
        if (placedCard !== null && selectedCard !== null) {
          isSelected = placedCard.record.id === selectedCard.record.id;
        }

        // What a tap on the slot does decides whether it is available:
        // - nothing is picked up: a tap picks up the card in the slot, so an empty slot has nothing to do;
        // - the slot holds the picked up card: a tap puts it back down (deselects), which changes nothing;
        // - otherwise: a tap puts the picked up card in this slot, which is a change.
        let disabled: boolean;
        if (selectedCard === null) {
          disabled = placedCard === null;
        } else if (isSelected) {
          disabled = false;
        } else {
          disabled = slotChangesDisabled;
        }

        return (
          <BinderSlot
            key={slotIndex}
            slotIndex={slotIndex}
            placedCard={placedCard}
            isSelected={isSelected}
            disabled={disabled}
            onClick={() => onSlotClick(slotIndex)}
          />
        );
      })}
    </ol>
  );
}