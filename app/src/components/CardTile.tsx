import { formatCount } from "../data/formatCount";
import type { Card } from "../data/types";
import { TileLink } from "./TileLink";

// A tile for a card as a whole, linking to the card's page. (SetCodeTile is the tile for one setcode of a card.)
// backLabel is the name of the page this tile is shown on, for the Back link on the page it opens.
// printingCount is how many printings (rarities and so on) the card has across all its setcodes.
// hasUnverifiedPrinting is whether any of those printings is not verified yet.
export function CardTile({
  card,
  printingCount,
  hasUnverifiedPrinting,
  backLabel,
}: {
  card: Card;
  printingCount: number;
  hasUnverifiedPrinting: boolean;
  backLabel: string;
}) {
  return (
    <TileLink
      to={`/cards/${card.card_id}`}
      backLabel={backLabel}
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