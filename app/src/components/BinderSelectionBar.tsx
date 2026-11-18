import { useState } from "react";
import { describeBinderCardPrinting, describePlacement, getBinderCardName } from "../data/binderPlacements";
import type { BinderCardWithPrinting } from "../data/binderPlacements";
import { clearCardPlacement } from "../data/binders";
import type { BinderRecord } from "../data/bindersDb";

// The bar that says which card is picked up and what can be done with it besides tapping a slot. It is only there while a
// card is picked up; the rest of the time its place in the pool toolbar is taken by the name filter (see BinderPool).
export function BinderSelectionBar({
  binder,
  selectedCard,
  changesDisabled,
  onClearSelection,
}: {
  binder: BinderRecord;
  selectedCard: BinderCardWithPrinting;
  changesDisabled: boolean;
  onClearSelection: () => void;
}) {
  const [returning, setReturning] = useState(false);

  async function handleReturnToPool() {
    setReturning(true);
    const result = await clearCardPlacement(selectedCard.record.id);
    setReturning(false);
    // Only a card that was saved as unplaced stops being selected; after a failure it stays picked up, and the banner
    // explains.
    if (result.status === "saved") {
      onClearSelection();
    }
  }

  const placement = selectedCard.record.placement;
  const placementText = placement === null ? "Not in a slot" : describePlacement(binder, placement);

  return (
    <div className="binder-selection-bar">
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
    </div>
  );
}