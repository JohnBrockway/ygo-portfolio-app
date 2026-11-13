import { useState } from "react";
import type { ReactNode } from "react";
import { editionLabel } from "../data/editions";
import type { ListEntry } from "../data/listEntries";
import { changeEntryQuantity } from "../data/lists";
import { OWNED_LIST_ID } from "../data/listsDb";
import { getVerifiedArtworks, printingName } from "../data/printings";
import { TileLink } from "./TileLink";

// One entry of a list: the specific printing and edition as a tile, with a button under it that removes the entry
// from the list. backLabel is the name of the page this is shown on, for the Back link.
export function ListEntryTile({
  listEntry,
  backLabel,
  changesDisabled,
}: {
  listEntry: ListEntry;
  backLabel: string;
  changesDisabled: boolean;
}) {
  const { entry, found } = listEntry;
  const [removing, setRemoving] = useState(false);

  const editionText = editionLabel(entry.edition);
  const name = found === null ? entry.printingId : found.card.title;
  const quantityTag = entry.listId === OWNED_LIST_ID ? <span className="tag">×{entry.quantity}</span> : null;

  async function handleRemove() {
    // More than one copy is only possible on Owned, and removing takes all of them off at once.
    if (entry.quantity > 1) {
      const confirmed = window.confirm(
        `Remove all ${entry.quantity} copies of "${name}" (${editionText}) from Owned?`,
      );
      if (!confirmed) {
        return;
      }
    }
    setRemoving(true);
    await changeEntryQuantity(entry.listId, entry.printingId, entry.edition, () => 0);
    // On success this tile is gone; on failure it stays, and the banner explains.
    setRemoving(false);
  }

  let tile: ReactNode;
  if (found === null) {
    tile = (
      <div className="tile tile-missing">
        <div className="tile-body">
          <div className="tile-title">Not in the card data</div>
          <div className="tile-meta">
            <span className="muted">{entry.printingId}</span>
          </div>
          <div className="tile-meta">
            <span className="muted">{editionText}</span>
            {quantityTag}
          </div>
        </div>
      </div>
    );
  } else {
    const { printing, setcode, card, set } = found;
    tile = (
      <TileLink
        to={`/printings/${setcode.setcode_id}`}
        backLabel={backLabel}
        card={card}
        artworks={getVerifiedArtworks([printing])}
        hasUnverifiedPrinting={!printing.verified}
      >
        <div className="tile-meta">
          {setcode.set_number_synthetic ? null : <span className="tag">{setcode.set_number}</span>}
          <span className="tag">{set.region}</span>
        </div>
        <div className="tile-meta">
          <span className="muted">
            {printingName(printing, setcode.printings)} · {editionText}
          </span>
          {quantityTag}
        </div>
      </TileLink>
    );
  }

  return (
    <div className="list-entry">
      {tile}
      <button
        className="action-button"
        type="button"
        aria-label={`Remove ${name} (${editionText}) from this list`}
        disabled={changesDisabled || removing}
        onClick={handleRemove}
      >
        Remove
      </button>
    </div>
  );
}