import { formatCount } from "../data/formatCount";
import type { Card } from "../data/types";
import { TileLink } from "./TileLink";

// A tile for a card as a whole, linking to the card's page. (SetCodeTile is the tile for one setcode of a card.)
// printingCount is how many printings (rarities and so on) the card has across all its setcodes.
// hasUnverifiedPrinting is whether any of those printings is not verified yet.
export function CardTile({
  card,
  printingCount,
  hasUnverifiedPrinting,
}: {
  card: Card;
  printingCount: number;
  hasUnverifiedPrinting: boolean;
}) {
  return (
    <TileLink
      to={`/cards/${card.card_id}`}
      card={card}
      artworks={[]}
      hasUnverifiedPrinting={hasUnverifiedPrinting}
    >
      <div className="tile-meta">
        <span className="muted">{formatCount(printingCount, "version", "versions")}</span>
      </div>
    </TileLink>
  );
}