import type { ReactNode } from "react";
import { getTileImageUrls } from "../data/images";
import type { EntryOwnership } from "../data/lists";
import type { Card } from "../data/types";
import { OwnedBadge } from "./OwnedBadge";
import { TileImage } from "./TileImage";
import { TileStack } from "./TileStack";

// A tile shows at most this many artworks, stacked.
const MAX_STACKED_IMAGES = 3;

const UNVERIFIED_LABEL = "Some printings are not verified";

// What is inside a tile: image with the unverified badge (bottom left) and the owned badge (bottom right) on it, and the
// card's title, with the caller's meta rows under it. The element around it (a link, a button, a plain box) is the
// caller's, and carries the tint (see tileTypeClass). The owned badge is only there when the caller passes ownership.
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
  let unverifiedBadge: ReactNode = null;
  if (hasUnverifiedPrinting) {
    unverifiedBadge = (
      <span className="tile-unverified" role="img" aria-label={UNVERIFIED_LABEL} title={UNVERIFIED_LABEL}>
        ?
      </span>
    );
  }

  let ownedBadge: ReactNode = null;
  if (ownership !== null) {
    ownedBadge = <OwnedBadge ownership={ownership} />;
  }

  // Several artworks are shown as a stack of images; one artwork (or the default image) is shown as it is.
  const imageUrls = getTileImageUrls(card, artworks).slice(0, MAX_STACKED_IMAGES);
  const image =
    imageUrls.length > 1 ? <TileStack imageUrls={imageUrls} /> : <TileImage imageUrl={imageUrls[0] ?? null} />;

  return (
    <>
      <div className="tile-image-frame">
        {image}
        {unverifiedBadge}
        {ownedBadge}
      </div>
      <div className="tile-body">
        <div className="tile-title">{card.title}</div>
        {children}
      </div>
    </>
  );
}