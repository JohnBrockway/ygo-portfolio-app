import type { ReactNode } from "react";
import { getTileImageUrls } from "../data/images";
import { getVerifiedArtworks } from "../data/printings";
import type { Card, SetCode } from "../data/types";
import { LinkWithReturnInfo } from "./LinkWithReturnInfo";
import { TileImage } from "./TileImage";
import { TileStack } from "./TileStack";

// A printing tile shows at most this many of its verified artworks, stacked.
const MAX_STACKED_IMAGES = 3;

function formatVersionCount(count: number): string {
  return count === 1 ? "1 version" : `${count} versions`;
}

// backLabel is the name of the page this tile is shown on, for the Back link on the page it opens.
// printingCount is how many printings (rarities and so on) the tile stands for: the setcode's own, or all the card's.
export function CardTile({
  card,
  setcode,
  printingCount,
  backLabel,
}: {
  card: Card;
  setcode?: SetCode;
  printingCount: number;
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

  // Several artworks are shown as a stack of images; one artwork (or the default image) is shown as it is.
  const imageUrls = getTileImageUrls(card, artworks).slice(0, MAX_STACKED_IMAGES);
  const image =
    imageUrls.length > 1 ? <TileStack imageUrls={imageUrls} /> : <TileImage imageUrl={imageUrls[0] ?? null} />;

  return (
    <LinkWithReturnInfo to={to} backLabel={backLabel} className="tile" title={card.title}>
      {image}
      <div className="tile-body">
        <div className="tile-title">{card.title}</div>
        <div className="tile-meta">
          {card.card_type ? <span className="tag">{card.card_type}</span> : null}
          {setNumberTag}
          <span className="muted">{formatVersionCount(printingCount)}</span>
        </div>
      </div>
    </LinkWithReturnInfo>
  );
}