import type { ReactNode } from "react";
import { tileTypeClass } from "../data/tileTypeClass";
import type { Card } from "../data/types";
import { LinkWithReturnInfo } from "./LinkWithReturnInfo";
import { TileContent } from "./TileContent";

// A tile that is a link: tint, unverified badge, image, and the card's title, with the caller's meta rows under it.
export function TileLink({
  to,
  backLabel,
  card,
  artworks,
  hasUnverifiedPrinting,
  children,
}: {
  to: string;
  backLabel: string;
  card: Card;
  artworks: string[];
  hasUnverifiedPrinting: boolean;
  children: ReactNode;
}) {
  return (
    <LinkWithReturnInfo to={to} backLabel={backLabel} className={tileTypeClass(card.card_type)} title={card.title}>
      <TileContent card={card} artworks={artworks} hasUnverifiedPrinting={hasUnverifiedPrinting}>
        {children}
      </TileContent>
    </LinkWithReturnInfo>
  );
}