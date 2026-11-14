import { formatCount } from "../data/formatCount";
import { getVerifiedArtworks, hasUnverifiedPrinting } from "../data/printings";
import type { Card, SetCode } from "../data/types";
import { TileLink } from "./TileLink";

// A tile for one setcode of a card (the card as printed in one set), linking directly to its printing page. It shows
// the set number and the verified artworks of the setcode's printings (the card's default image if none is verified).
// backLabel is the name of the page this tile is shown on, for the Back link on the page it opens.
export function SetCodeTile({ card, setcode, backLabel }: { card: Card; setcode: SetCode; backLabel: string }) {
  return (
    <TileLink
      to={`/printings/${setcode.setcode_id}`}
      backLabel={backLabel}
      card={card}
      artworks={getVerifiedArtworks(setcode.printings)}
      hasUnverifiedPrinting={hasUnverifiedPrinting(setcode.printings)}
    >
      <div className="tile-meta">
        {setcode.set_number_synthetic ? null : <span className="tag">{setcode.set_number}</span>}
        <span className="muted">{formatCount(setcode.printings.length, "version", "versions")}</span>
      </div>
    </TileLink>
  );
}