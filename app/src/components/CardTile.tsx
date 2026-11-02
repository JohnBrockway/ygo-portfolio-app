import { Link } from "react-router-dom";
import { cardImageUrl } from "../data/images";
import type { Card } from "../data/types";
import { TileImage } from "./TileImage";

export function CardTile({ card }: { card: Card }) {
  return (
    <Link to={`/cards/${card.card_id}`} className="tile" title={card.title}>
      <TileImage imageUrl={cardImageUrl(card)} />
      <div className="tile-body">
        <div className="tile-title">{card.title}</div>
        <div className="tile-meta">{card.card_type ? <span className="tag">{card.card_type}</span> : null}</div>
      </div>
    </Link>
  );
}