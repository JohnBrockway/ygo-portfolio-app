import type { ReactNode } from "react";
import { describeBinderCard } from "../data/binderPlacements";
import type { BinderCardWithPrinting } from "../data/binderPlacements";
import { BinderCardCompact } from "./BinderCardCompact";

// One slot of a binder page: its number while empty, the compact card once a card is placed in it. Always a button; what
// a tap does (pick the card up, put the picked up card down) is the caller's, and it also decides when the button is
// disabled.
export function BinderSlot({
  slotIndex,
  placedCard,
  isSelected,
  disabled,
  onClick,
}: {
  slotIndex: number;
  // null for an empty slot.
  placedCard: BinderCardWithPrinting | null;
  // Whether the card in this slot is the selected one.
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const slotNumber = slotIndex + 1;

  let slotClass = "binder-slot";
  let label: string;
  let contents: ReactNode;
  // Only a slot with a card can be selected, so only that one is a toggle, and it is the only one with a tooltip: the
  // caption on a small card is cut short, and the tooltip has the whole name for anyone with a mouse.
  let isPressed: boolean | undefined;
  let tooltip: string | undefined;

  if (placedCard === null) {
    label = `Slot ${slotNumber}, empty`;
    contents = <span>{slotNumber}</span>;
  } else {
    slotClass += " binder-slot-filled";
    label = `Slot ${slotNumber}: ${describeBinderCard(placedCard)}`;
    contents = <BinderCardCompact binderCard={placedCard} />;
    isPressed = isSelected;
    tooltip = describeBinderCard(placedCard);
  }

  if (isSelected) {
    slotClass += " binder-slot-selected";
  }

  return (
    <li className={slotClass}>
      <button
        className="binder-slot-button"
        type="button"
        aria-label={label}
        aria-pressed={isPressed}
        title={tooltip}
        disabled={disabled}
        onClick={onClick}
      >
        {contents}
      </button>
    </li>
  );
}