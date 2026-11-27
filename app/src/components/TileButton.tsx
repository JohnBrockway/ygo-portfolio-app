import type { ReactNode } from "react";
import type { EntryOwnership } from "../data/lists";
import { selectableTileClass } from "../data/tileSelection";
import type { TileSelection } from "../data/tileSelection";
import { tileTypeClass } from "../data/tileTypeClass";
import type { Card } from "../data/types";
import { TileContent } from "./TileContent";

// A tile that is a button, for picking it in select mode (the counterpart of TileLink): tint, unverified badge, owned
// badge (when ownership is given), image, and the card's title, with the caller's meta rows under it. Tapping it
// toggles the selection, and it is pressed while it is selected.
export function TileButton({
  card,
  artworks,
  hasUnverifiedPrinting,
  ownership = null,
  selection,
  children,
}: {
  card: Card;
  artworks: string[];
  hasUnverifiedPrinting: boolean;
  ownership?: EntryOwnership | null;
  selection: TileSelection;
  children: ReactNode;
}) {
  return (
    <button
      className={selectableTileClass(tileTypeClass(card.card_type), selection)}
      type="button"
      aria-pressed={selection.isSelected}
      title={card.title}
      onClick={selection.onToggle}
    >
      <TileContent
        card={card}
        artworks={artworks}
        hasUnverifiedPrinting={hasUnverifiedPrinting}
        ownership={ownership}
      >
        {children}
      </TileContent>
    </button>
  );
}