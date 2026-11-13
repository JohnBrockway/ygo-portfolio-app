import type { ReactNode } from "react";
import { getTileImageUrls } from "../data/images";
import type { Card } from "../data/types";
import { LinkWithReturnInfo } from "./LinkWithReturnInfo";
import { TileImage } from "./TileImage";
import { TileStack } from "./TileStack";

// A tile shows at most this many artworks, stacked.
const MAX_STACKED_IMAGES = 3;

const UNVERIFIED_LABEL = "Some printings are not verified";

// The CSS class that tints a tile to hint at its card type.
function tileTypeClass(cardType: string): string {
  switch (cardType) {
    case "Monster":
      return "tile tile-monster";
    case "Spell":
      return "tile tile-spell";
    case "Trap":
      return "tile tile-trap";
    default:
      return "tile";
  }
}

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

  const typeClass = tileTypeClass(card.card_type);

  return (
    <LinkWithReturnInfo to={to} backLabel={backLabel} className={typeClass} title={card.title}>
      {unverifiedBadge}
      {image}
      <div className="tile-body">
        <div className="tile-title">{card.title}</div>
        {children}
      </div>
    </LinkWithReturnInfo>
  );
}