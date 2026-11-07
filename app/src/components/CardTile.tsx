import type { ReactNode } from "react";
import { getDefaultImageUrl } from "../data/images";
import type { Card, Printing } from "../data/types";
import { LinkWithReturnInfo } from "./LinkWithReturnInfo";
import { TileImage } from "./TileImage";

export function CardTile({ card, printing }: { card: Card; printing?: Printing }) {
  let to = `/cards/${card.card_id}`;

  // For printings, link directly to the printing and show the set number and rarity.
  let printingTags: ReactNode = null;
  if (printing !== undefined) {
    to = `/printings/${printing.printing_id}`;
    printingTags = (
      <>
        {printing.set_number_synthetic ? null : <span className="tag">{printing.set_number}</span>}
        <span className="tag">{printing.rarity}</span>
      </>
    );
  }

  return (
    <LinkWithReturnInfo to={to} backLabel="card search" className="tile" title={card.title}>
      <TileImage imageUrl={getDefaultImageUrl(card)} />
      <div className="tile-body">
        <div className="tile-title">{card.title}</div>
        <div className="tile-meta">
          {card.card_type ? <span className="tag">{card.card_type}</span> : null}
          {printingTags}
        </div>
      </div>
    </LinkWithReturnInfo>
  );
}