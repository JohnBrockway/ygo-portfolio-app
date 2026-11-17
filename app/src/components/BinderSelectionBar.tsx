import { useState } from "react";
import type { ReactNode } from "react";
import { describeBinderCardPrinting, describePlacement, getBinderCardName } from "../data/binderPlacements";
import type { BinderCardWithPrinting } from "../data/binderPlacements";
import { clearCardPlacement } from "../data/binders";
import type { BinderRecord } from "../data/bindersDb";

// The bar that says which card is picked up and what can be done with it besides tapping a slot. It is always there, with
// a hint while nothing is picked up, so the tiles under it don't move when a card is selected.
export function BinderSelectionBar({
  binder,
  selectedCard,
  changesDisabled,
  onClearSelection,
}: {
  binder: BinderRecord;
  // null while nothing is picked up.
  selectedCard: BinderCardWithPrinting | null;
  changesDisabled: boolean;
  onClearSelection: () => void;
}) {
  const [returning, setReturning] = useState(false);

  async function handleReturnToPool() {
    // The button that calls this is only shown while a card is selected.
    if (selectedCard === null) {
      return;
    }

    setReturning(true);
    const result = await clearCardPlacement(selectedCard.record.id);
    setReturning(false);
    // Only a card that was saved as unplaced stops being selected; after a failure it stays picked up, and the banner
    // explains.
    if (result.status === "saved") {
      onClearSelection();
    }
  }

  let contents: ReactNode;
  if (selectedCard === null) {
    contents = <p className="binder-selection-hint muted">Tap a card to pick it up, then tap a slot to place it.</p>;
  } else {
    const placement = selectedCard.record.placement;
    const placementText = placement === null ? "Not in a slot" : describePlacement(binder, placement);

    contents = (
      <>
        <div className="binder-selection-info">
          <div className="binder-selection-name">
            <span className="binder-selection-card-name">{getBinderCardName(selectedCard)}</span>
            <span className="muted"> · {describeBinderCardPrinting(selectedCard)}</span>
          </div>
          <div className="muted">{placementText}</div>
        </div>
        <div className="binder-selection-actions">
          <button
            className="action-button"
            type="button"
            disabled={placement === null || changesDisabled || returning}
            onClick={handleReturnToPool}
          >
            Return to pool
          </button>
          <button className="action-button" type="button" onClick={onClearSelection}>
            Cancel
          </button>
        </div>
      </>
    );
  }

  return <div className="binder-selection-bar">{contents}</div>;
}