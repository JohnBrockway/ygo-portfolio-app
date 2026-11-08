import type { ReactNode } from "react";
import { getDefaultImageUrl } from "../data/images";
import type { Card, SetCode } from "../data/types";
import { LinkWithReturnInfo } from "./LinkWithReturnInfo";
import { TileImage } from "./TileImage";

export function CardTile({ card, setcode }: { card: Card; setcode?: SetCode }) {
  let to = `/cards/${card.card_id}`;

  // For printings, link directly to the printing page and show the set number.
  let setNumberTag: ReactNode = null;
  if (setcode !== undefined) {
    to = `/printings/${setcode.setcode_id}`;
    setNumberTag = setcode.set_number_synthetic ? null : <span className="tag">{setcode.set_number}</span>;
  }

  return (
    <LinkWithReturnInfo to={to} backLabel="card search" className="tile" title={card.title}>
      <TileImage imageUrl={getDefaultImageUrl(card)} />
      <div className="tile-body">
        <div className="tile-title">{card.title}</div>
        <div className="tile-meta">
          {card.card_type ? <span className="tag">{card.card_type}</span> : null}
          {setNumberTag}
        </div>
      </div>
    </LinkWithReturnInfo>
  );
}