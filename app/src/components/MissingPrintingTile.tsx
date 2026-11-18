import type { ReactNode } from "react";
import { editionLabel } from "../data/editions";
import type { EntryOwnership } from "../data/lists";
import type { Edition } from "../data/types";
import { OwnedBadge } from "./OwnedBadge";

// The tile for a printing + edition that the master data doesn't have (for example after the data was rebuilt without
// it). It isn't a link, because there is nothing to open. extraTag goes at the end of the edition row. ownership is how
// much of the printing and edition is owned, for the badge in the bottom-right corner of the tile (the tile has no image,
// so the tile itself is what the badge is placed against); it is null where there is no badge.
export function MissingPrintingTile({
  printingId,
  edition,
  extraTag = null,
  ownership = null,
}: {
  printingId: string;
  edition: Edition;
  extraTag?: ReactNode;
  ownership?: EntryOwnership | null;
}) {
  return (
    <div className="tile tile-missing">
      <div className="tile-body">
        <div className="tile-title">Not in the card data</div>
        <div className="tile-meta">
          <span className="muted">{printingId}</span>
        </div>
        <div className="tile-meta">
          <span className="muted">{editionLabel(edition)}</span>
          {extraTag}
        </div>
      </div>
      {ownership === null ? null : <OwnedBadge ownership={ownership} />}
    </div>
  );
}