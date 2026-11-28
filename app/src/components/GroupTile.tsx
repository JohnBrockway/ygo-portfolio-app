import type { DemandSatisfaction } from "../data/demandSatisfaction";
import type { RecordWithFoundPrinting } from "../data/foundPrintings";
import { getPrintingImageUrls } from "../data/images";
import type { ListEntryRecord } from "../data/listsDb";
import { hasUnverifiedPrinting } from "../data/printings";
import { tileTypeClass } from "../data/tileTypeClass";
import { StackIcon } from "./ActionIcons";
import { GroupSatisfactionBadge } from "./OwnedBadge";
import { TileLayout } from "./TileLayout";

const STACK_LABEL = "A group: any one of its entries will do";

// The badge on the bottom-left corner of a group's tile, which tells it apart from the tile of a single entry.
function GroupStackBadge() {
  return (
    <span className="tile-group-badge" role="img" aria-label={STACK_LABEL} title={STACK_LABEL}>
      <StackIcon />
    </span>
  );
}

// A live group on a list page, folded up into one tile: a stack of the images of its members, the title, how many members
// there are, a badge saying it is a group and one saying how much of what the group asks for is owned. The tile is a
// button that opens the group (see EntryGroupContainer for what it opens into). tiles are the group's members, in the
// order they are shown in.
export function GroupTile({
  title,
  tiles,
  satisfaction,
  onExpand,
}: {
  title: string;
  tiles: readonly RecordWithFoundPrinting<ListEntryRecord>[];
  satisfaction: DemandSatisfaction;
  onExpand: () => void;
}) {
  // Members the master data doesn't know have no image, card or printing to show.
  const foundPrintings = tiles.flatMap(({ found }) => (found === null ? [] : [found]));

  // The tint of the first member that has a card, which is the first member unless the master data doesn't know it.
  const [firstFound] = foundPrintings;
  const tintClass = firstFound === undefined ? "tile" : tileTypeClass(firstFound.card.card_type);

  return (
    <button
      className={`${tintClass} tile-selectable`}
      type="button"
      aria-expanded={false}
      aria-label={`Expand group ${title}`}
      onClick={onExpand}
    >
      <TileLayout
        imageUrls={getPrintingImageUrls(foundPrintings)}
        title={title}
        hasUnverifiedPrinting={hasUnverifiedPrinting(foundPrintings.map(({ printing }) => printing))}
        ownedBadge={<GroupSatisfactionBadge satisfaction={satisfaction} />}
        stackBadge={<GroupStackBadge />}
      >
        <div className="tile-meta">
          <span className="tag">Any of {tiles.length}</span>
        </div>
      </TileLayout>
    </button>
  );
}