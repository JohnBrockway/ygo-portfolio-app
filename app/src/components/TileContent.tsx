import type { ReactNode } from "react";
import { getTileImageUrls } from "../data/images";
import type { Card } from "../data/types";
import { TileImage } from "./TileImage";
import { TileStack } from "./TileStack";

// A tile shows at most this many artworks, stacked.
const MAX_STACKED_IMAGES = 3;

const UNVERIFIED_LABEL = "Some printings are not verified";

// What is inside a tile: unverified badge, image, and the card's title, with the caller's meta rows under it. The
// element around it (a link, a button, a plain box) is the caller's, and carries the tint (see tileTypeClass).
export function TileContent({
  card,
  artworks,
  hasUnverifiedPrinting,
  children,
}: {
  card: Card;
  artworks: string[];
  hasUnverifiedPrinting: boolean;
  children: ReactNode;
}) {
  let unverifiedBadge: ReactNode = null;
  if (hasUnverifiedPrinting) {
    unverifiedBadge = (
      <span className="tile-unverified" role="img" aria-label={UNVERIFIED_LABEL} title={UNVERIFIED_LABEL}>
        ?
      </span>
    );
  }

  // Several artworks are shown as a stack of images; one artwork (or the default image) is shown as it is.
  const imageUrls = getTileImageUrls(card, artworks).slice(0, MAX_STACKED_IMAGES);
  const image =
    imageUrls.length > 1 ? <TileStack imageUrls={imageUrls} /> : <TileImage imageUrl={imageUrls[0] ?? null} />;

  return (
    <>
      {unverifiedBadge}
      {image}
      <div className="tile-body">
        <div className="tile-title">{card.title}</div>
        {children}
      </div>
    </>
  );
}