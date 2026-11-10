import type { ReactNode } from "react";
import { getTileImageUrl } from "../data/images";
import { getFirstVerifiedArtwork } from "../data/printings";
import type { Card, SetCode } from "../data/types";
import { LinkWithReturnInfo } from "./LinkWithReturnInfo";
import { TileImage } from "./TileImage";

function formatVersionCount(count: number): string {
  return count === 1 ? "1 version" : `${count} versions`;
}

// backLabel is the name of the page this tile is shown on, for the Back link on the page it opens.
// printingCount is how many printings (rarities and so on) the tile stands for: the setcode's own, or all the card's.
export function CardTile({
  card,
  setcode,
  printingCount,
  backLabel,
}: {
  card: Card;
  setcode?: SetCode;
  printingCount: number;
  backLabel: string;
}) {
  let to = `/cards/${card.card_id}`;

  let artwork: string | null = null;

  // For printings, link directly to the printing page, show the set number, and show the artwork of the
  // setcode's first verified printing (the default image if none is verified).
  let setNumberTag: ReactNode = null;
  if (setcode !== undefined) {
    to = `/printings/${setcode.setcode_id}`;
    artwork = getFirstVerifiedArtwork(setcode.printings);
    setNumberTag = setcode.set_number_synthetic ? null : <span className="tag">{setcode.set_number}</span>;
  }

  return (
    <LinkWithReturnInfo to={to} backLabel={backLabel} className="tile" title={card.title}>
      <TileImage imageUrl={getTileImageUrl(card, artwork)} />
      <div className="tile-body">
        <div className="tile-title">{card.title}</div>
        <div className="tile-meta">
          {card.card_type ? <span className="tag">{card.card_type}</span> : null}
          {setNumberTag}
          <span className="muted">{formatVersionCount(printingCount)}</span>
        </div>
      </div>
    </LinkWithReturnInfo>
  );
}