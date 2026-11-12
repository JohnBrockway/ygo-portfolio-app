import { changeEntryQuantity, getEntryQuantity, useLiveLists } from "../data/lists";
import { OWNED_LIST_ID } from "../data/listsDb";
import type { Edition } from "../data/types";

// How many copies of this printing's edition are owned, with a -/+ to change it.
export function OwnedStepper({
  printingId,
  edition,
  label,
}: {
  printingId: string;
  edition: Edition;
  label: string;
}) {
  const lists = useLiveLists();
  const isReady = lists.status === "ready";
  const owned = getEntryQuantity(lists, OWNED_LIST_ID, printingId, edition);

  return (
    <div className="stepper" role="group" aria-label={`Owned, ${label}`}>
      <button
        type="button"
        className="action-button"
        aria-label={`Remove one ${label} copy`}
        disabled={!isReady || owned === 0}
        onClick={() => void changeEntryQuantity(OWNED_LIST_ID, printingId, edition, (current) => current - 1)}
      >
        −
      </button>
      <span className="stepper-value">{owned}</span>
      <button
        type="button"
        className="action-button"
        aria-label={`Add one ${label} copy`}
        disabled={!isReady}
        onClick={() => void changeEntryQuantity(OWNED_LIST_ID, printingId, edition, (current) => current + 1)}
      >
        +
      </button>
    </div>
  );
}