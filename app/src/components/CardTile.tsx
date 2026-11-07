import { getDefaultImageUrl } from "../data/images";
import type { Card } from "../data/types";
import { LinkWithReturnInfo } from "./LinkWithReturnInfo";
import { TileImage } from "./TileImage";

export function CardTile({ card }: { card: Card }) {
  return (
    <LinkWithReturnInfo to={`/cards/${card.card_id}`} backLabel="card search" className="tile" title={card.title}>
      <TileImage imageUrl={getDefaultImageUrl(card)} />
      <div className="tile-body">
        <div className="tile-title">{card.title}</div>
        <div className="tile-meta">{card.card_type ? <span className="tag">{card.card_type}</span> : null}</div>
      </div>
    </LinkWithReturnInfo>
  );
}