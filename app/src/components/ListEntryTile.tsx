import { useState } from "react";
import type { ReactNode } from "react";
import { editionLabel } from "../data/editions";
import type { RecordWithFoundPrinting } from "../data/foundPrintings";
import { changeEntryQuantity } from "../data/lists";
import { OWNED_LIST_ID } from "../data/listsDb";
import type { ListEntryRecord } from "../data/listsDb";
import { getVerifiedArtworks } from "../data/printings";
import { MissingPrintingTile } from "./MissingPrintingTile";
import { PrintingTileMeta } from "./PrintingTileMeta";
import { TileLink } from "./TileLink";

// One entry of a list: the specific printing and edition as a tile, with a button under it that removes the entry
// from the list. backLabel is the name of the page this is shown on, for the Back link.
export function ListEntryTile({
  listEntry,
  backLabel,
  changesDisabled,
}: {
  listEntry: RecordWithFoundPrinting<ListEntryRecord>;
  backLabel: string;
  changesDisabled: boolean;
}) {
  const { record: entry, found } = listEntry;
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
    tile = <MissingPrintingTile printingId={entry.printingId} edition={entry.edition} extraTag={quantityTag} />;
  } else {
    tile = (
      <TileLink
        to={`/printings/${found.setcode.setcode_id}`}
        backLabel={backLabel}
        card={found.card}
        artworks={getVerifiedArtworks([found.printing])}
        hasUnverifiedPrinting={!found.printing.verified}
      >
        <PrintingTileMeta found={found} edition={entry.edition} extraTag={quantityTag} />
      </TileLink>
    );
  }

  return (
    <div className="tile-with-remove">
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