import type { ReactNode } from "react";
import { getTileImageUrls } from "../data/images";
import { getVerifiedArtworks } from "../data/printings";
import type { Card, SetCode } from "../data/types";
import { LinkWithReturnInfo } from "./LinkWithReturnInfo";
import { TileImage } from "./TileImage";
import { TileStack } from "./TileStack";

// A printing tile shows at most this many of its verified artworks, stacked.
const MAX_STACKED_IMAGES = 3;

const UNVERIFIED_LABEL = "Some printings are not verified";

function formatVersionCount(count: number): string {
  return count === 1 ? "1 version" : `${count} versions`;
}

// The CSS class that tints a tile to hint at its card type.
function tileTypeClass(cardType: string | null | undefined): string {
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

// backLabel is the name of the page this tile is shown on, for the Back link on the page it opens.
// printingCount is how many printings (rarities and so on) the tile stands for: the setcode's own, or all the card's.
// hasUnverifiedPrinting is whether any of those printings is not verified yet.
export function CardTile({
  card,
  setcode,
  printingCount,
  hasUnverifiedPrinting,
  backLabel,
}: {
  card: Card;
  setcode?: SetCode;
  printingCount: number;
  hasUnverifiedPrinting: boolean;
  backLabel: string;
}) {
  let to = `/cards/${card.card_id}`;

  let artworks: string[] = [];

  // For printings, link directly to the printing page, show the set number, and show the verified artworks
  // of the setcode's printings (the default image if none is verified).
  let setNumberTag: ReactNode = null;
  if (setcode !== undefined) {
    to = `/printings/${setcode.setcode_id}`;
    artworks = getVerifiedArtworks(setcode.printings);
    setNumberTag = setcode.set_number_synthetic ? null : <span className="tag">{setcode.set_number}</span>;
  }

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
        <div className="tile-meta">
          {setNumberTag}
          <span className="muted">{formatVersionCount(printingCount)}</span>
        </div>
      </div>
    </LinkWithReturnInfo>
  );
}