import { editionLabel } from "../data/editions";
import { changeEntryQuantity, getEntry, useLiveLists } from "../data/lists";
import { OWNED_LIST_ID } from "../data/listsDb";
import type { Edition } from "../data/types";

// One cell per edition the set has, side by side, each with a +/- for how many copies are owned.
// TODO the wishlist button goes here too.
export function EditionCells({ editions, printingId }: { editions: Edition[]; printingId: string }) {
  const lists = useLiveLists();
  const isReady = lists.status === "ready";

  if (editions.length === 0) {
    return (
      <ul className="edition-cells">
        <li className="edition-cell">
          <div className="edition-label">No edition</div>
        </li>
      </ul>
    );
  }

  return (
    <ul className="edition-cells">
      {editions.map((edition) => {
        const entry = getEntry(lists, OWNED_LIST_ID, printingId, edition);
        const owned = entry === undefined ? 0 : entry.quantity;
        const label = editionLabel(edition);

        return (
          <li key={edition} className="edition-cell">
            <div className="edition-label">{label}</div>
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
          </li>
        );
      })}
    </ul>
  );
}