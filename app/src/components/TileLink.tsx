import type { ReactNode } from "react";
import type { EntryOwnership } from "../data/lists";
import { tileTypeClass } from "../data/tileTypeClass";
import type { Card } from "../data/types";
import { TileContent } from "./TileContent";
import { Link } from "react-router-dom";

// A tile that is a link: tint, unverified badge, owned badge (when ownership is given), image, and the card's title, with
// the caller's meta rows under it.
export function TileLink({
  to,
  card,
  artworks,
  hasUnverifiedPrinting,
  ownership = null,
  children,
}: {
  to: string;
  card: Card;
  artworks: string[];
  hasUnverifiedPrinting: boolean;
  ownership?: EntryOwnership | null;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={tileTypeClass(card.card_type)} title={card.title}>
      <TileContent
        card={card}
        artworks={artworks}
        hasUnverifiedPrinting={hasUnverifiedPrinting}
        ownership={ownership}
      >
        {children}
      </TileContent>
    </Link>
  );
}