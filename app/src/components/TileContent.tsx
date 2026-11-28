import type { ReactNode } from "react";
import { getTileImageUrls } from "../data/images";
import type { EntryOwnership } from "../data/lists";
import type { Card } from "../data/types";
import { OwnedBadge } from "./OwnedBadge";
import { TileLayout } from "./TileLayout";

// What is inside a tile of one card: its image (the artworks, stacked, if there are several) with the unverified badge
// (bottom left) and the owned badge (bottom right) on it, and the card's title, with the caller's meta rows under it. The
// element around it (a link, a button, a plain box) is the caller's, and carries the tint (see tileTypeClass). The owned
// badge is only there when the caller passes ownership.
export function TileContent({
  card,
  artworks,
  hasUnverifiedPrinting,
  ownership = null,
  children,
}: {
  card: Card;
  artworks: string[];
  hasUnverifiedPrinting: boolean;
  ownership?: EntryOwnership | null;
  children: ReactNode;
}) {
  let ownedBadge: ReactNode = null;
  if (ownership !== null) {
    ownedBadge = <OwnedBadge ownership={ownership} />;
  }

  return (
    <TileLayout
      imageUrls={getTileImageUrls(card, artworks)}
      title={card.title}
      hasUnverifiedPrinting={hasUnverifiedPrinting}
      ownedBadge={ownedBadge}
    >
      {children}
    </TileLayout>
  );
}