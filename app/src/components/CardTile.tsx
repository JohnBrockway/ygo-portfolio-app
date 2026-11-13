import type { ReactNode } from "react";
import { formatCount } from "../data/formatCount";
import { getVerifiedArtworks } from "../data/printings";
import type { Card, SetCode } from "../data/types";
import { TileLink } from "./TileLink";

// backLabel is the name of the page this tile is shown on, for the Back link on the page it opens.
// printingCount is how many printings (rarities and so on) the tile stands for: the setcode's own, or all the card's.
// hasUnverifiedPrinting is whether any of those printings is not verified yet.
export function CardTile({
  card,
  setcode,
  printingCount,
  hasUnverifiedPrinting,
  backLabel,
}: {
  card: Card;
  setcode?: SetCode;
  printingCount: number;
  hasUnverifiedPrinting: boolean;
  backLabel: string;
}) {
  let to = `/cards/${card.card_id}`;

  let artworks: string[] = [];

  // For printings, link directly to the printing page, show the set number, and show the verified artworks
  // of the setcode's printings (the default image if none is verified).
  let setNumberTag: ReactNode = null;
  if (setcode !== undefined) {
    to = `/printings/${setcode.setcode_id}`;
    artworks = getVerifiedArtworks(setcode.printings);
    setNumberTag = setcode.set_number_synthetic ? null : <span className="tag">{setcode.set_number}</span>;
  }

  return (
    <TileLink
      to={to}
      backLabel={backLabel}
      card={card}
      artworks={artworks}
      hasUnverifiedPrinting={hasUnverifiedPrinting}
    >
      <div className="tile-meta">
        {setNumberTag}
        <span className="muted">{formatCount(printingCount, "version", "versions")}</span>
      </div>
    </TileLink>
  );
}