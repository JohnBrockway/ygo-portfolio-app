import { useState } from "react";
import { describeBinderCard } from "../data/binderPlacements";
import type { BinderCardWithPrinting } from "../data/binderPlacements";
import { removeCardFromBinder } from "../data/binders";
import { BinderCardCompact } from "./BinderCardCompact";
import { CornerRemoveButton } from "./CornerRemoveButton";

// One card in a binder's card pool (one physical copy that is not in a slot): the compact card, as a button, with a
// button on its corner that removes the card from the binder. Tapping the card picks it up (or puts it back down), and
// the slot to place it in is tapped on the page. The caller puts it in a list item (the corner button is placed against
// that, see .tile-grid in index.css).
export function BinderPoolCard({
  binderCard,
  isSelected,
  changesDisabled,
  onToggleSelection,
}: {
  binderCard: BinderCardWithPrinting;
  // Whether this is the card that is picked up.
  isSelected: boolean;
  changesDisabled: boolean;
  onToggleSelection: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    await removeCardFromBinder(binderCard.record.id);
    // On success this card is gone; on failure it stays, and the banner explains.
    setRemoving(false);
  }

  // The caption on a small card is cut short, so the whole description is the label and the tooltip.
  const description = describeBinderCard(binderCard);

  let cardClass = "binder-pool-card";
  if (isSelected) {
    cardClass += " binder-pool-card-selected";
  }

  return (
    <>
      <button
        className={cardClass}
        type="button"
        aria-label={description}
        aria-pressed={isSelected}
        title={description}
        onClick={onToggleSelection}
      >
        <BinderCardCompact binderCard={binderCard} />
      </button>
      <CornerRemoveButton
        label={`Remove ${description} from this binder`}
        disabled={changesDisabled || removing}
        onClick={handleRemove}
      />
    </>
  );
}