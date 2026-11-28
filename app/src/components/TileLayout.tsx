import type { ReactNode } from "react";
import { ImageStack } from "./ImageStack";
import { TileImage } from "./TileImage";

// A tile shows at most this many images, stacked.
const MAX_STACKED_IMAGES = 3;

const UNVERIFIED_LABEL = "Some printings are not verified";

// What is inside a tile, whatever the tile stands for (one card, or a group of entries): the image with the badges on it
// (the group badge at the top tight, the unverified badge at the bottom left, the owned badge at the bottom right), and the
// title, with the caller's meta rows under it. The caller works out the image URLs (all of them: this shows the first few), the title,
// the owned badge (null for none) and the group badge (null for none, which is also the default: only a group has one).
// The element around it (a link, a button, a plain box) is the caller's, and carries the tint (see tileTypeClass).
export function TileLayout({
  imageUrls,
  title,
  hasUnverifiedPrinting,
  ownedBadge,
  stackBadge = null,
  children,
}: {
  imageUrls: string[];
  title: string;
  hasUnverifiedPrinting: boolean;
  ownedBadge: ReactNode;
  stackBadge?: ReactNode;
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

  // Several images are shown as a stack; one image (or none, which shows the placeholder) is shown as it is.
  const stackedImageUrls = imageUrls.slice(0, MAX_STACKED_IMAGES);
  const image =
    stackedImageUrls.length > 1 ? (
      <ImageStack imageUrls={stackedImageUrls} />
    ) : (
      <TileImage imageUrl={stackedImageUrls[0] ?? null} />
    );

  return (
    <>
      <div className="tile-image-frame">
        {image}
        {stackBadge}
        {unverifiedBadge}
        {ownedBadge}
      </div>
      <div className="tile-body">
        <div className="tile-title">{title}</div>
        {children}
      </div>
    </>
  );
}