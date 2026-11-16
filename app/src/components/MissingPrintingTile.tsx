import type { ReactNode } from "react";
import { editionLabel } from "../data/editions";
import type { Edition } from "../data/types";

// The tile for a printing + edition that the master data doesn't have (for example after the data was rebuilt without
// it). It isn't a link, because there is nothing to open. extraTag goes at the end of the edition row.
export function MissingPrintingTile({
  printingId,
  edition,
  extraTag = null,
}: {
  printingId: string;
  edition: Edition;
  extraTag?: ReactNode;
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
    </div>
  );
}