import type { ReactNode } from "react";
import { getDefaultImageUrl } from "../data/images";
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

  // For printings, link directly to the printing page and show the set number.
  let setNumberTag: ReactNode = null;
  if (setcode !== undefined) {
    to = `/printings/${setcode.setcode_id}`;
    setNumberTag = setcode.set_number_synthetic ? null : <span className="tag">{setcode.set_number}</span>;
  }

  return (
    <LinkWithReturnInfo to={to} backLabel={backLabel} className="tile" title={card.title}>
      <TileImage imageUrl={getDefaultImageUrl(card)} />
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