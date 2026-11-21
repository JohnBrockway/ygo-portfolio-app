import { useState } from "react";
import type { ReactNode } from "react";
import { editionLabel } from "../data/editions";
import type { RecordWithFoundPrinting } from "../data/foundPrintings";
import { changeEntryQuantity } from "../data/lists";
import type { EntryOwnership } from "../data/lists";
import { OWNED_LIST_ID } from "../data/listsDb";
import type { ListEntryRecord } from "../data/listsDb";
import { getVerifiedArtworks } from "../data/printings";
import { CornerRemoveButton } from "./CornerRemoveButton";
import { MissingPrintingTile } from "./MissingPrintingTile";
import { PrintingTileMeta } from "./PrintingTileMeta";
import { TileLink } from "./TileLink";

// One entry of a list: the specific printing and edition as a tile, with a button on its corner that removes the
// entry from the list. ownership is how much of the entry's printing and edition is owned, for the badge on the tile;
// it is null where there is no badge.
export function ListEntryTile({
  listEntry,
  ownership,
  changesDisabled,
}: {
  listEntry: RecordWithFoundPrinting<ListEntryRecord>;
  ownership: EntryOwnership | null;
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
    await changeEntryQuantity(entry.listId, entry.cardId, entry.printingId, entry.edition, () => 0);
    // On success this tile is gone; on failure it stays, and the banner explains.
    setRemoving(false);
  }

  let tile: ReactNode;
  if (found === null) {
    tile = (
      <MissingPrintingTile
        printingId={entry.printingId}
        edition={entry.edition}
        extraTag={quantityTag}
        ownership={ownership}
      />
    );
  } else {
    tile = (
      <TileLink
        to={`/printings/${found.setcode.setcode_id}`}
        card={found.card}
        artworks={getVerifiedArtworks([found.printing])}
        hasUnverifiedPrinting={!found.printing.verified}
        ownership={ownership}
      >
        <PrintingTileMeta found={found} edition={entry.edition} extraTag={quantityTag} />
      </TileLink>
    );
  }

  return (
    <>
      {tile}
      <CornerRemoveButton
        label={`Remove ${name} (${editionText}) from this list`}
        disabled={changesDisabled || removing}
        onClick={handleRemove}
      />
    </>
  );
}