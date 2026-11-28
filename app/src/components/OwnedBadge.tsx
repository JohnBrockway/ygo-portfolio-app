import type { DemandSatisfaction, SatisfactionLevel } from "../data/demandSatisfaction";
import type { EntryOwnership } from "../data/lists";
import { CheckIcon } from "./ActionIcons";

const OWNED_LABEL = "Owned";
const NOT_OWNED_LABEL = "Not owned";

// The class names of each level: the base class is the ring every level has, and the other class changes how it is
// filled (see index.css).
const LEVEL_CLASS_NAMES: Record<SatisfactionLevel, string> = {
  none: "tile-owned",
  partial: "tile-owned tile-owned-partial",
  complete: "tile-owned tile-owned-complete",
};

// What to call a level, given how many copies are owned and how many are wished.
function getLevelLabel(level: SatisfactionLevel, ownedCount: number, wishedCount: number): string {
  if (level === "none") {
    return NOT_OWNED_LABEL;
  } else if (level === "complete") {
    return OWNED_LABEL;
  } else {
    return `${ownedCount} out of ${wishedCount} wished copies owned`;
  }
}

// How much of what the user wants of this printing and edition they own, and what to call it, or null where nothing is
// wanted so the tile has no badge.
// - nothing owned: none;
// - at least as many owned as wished: complete;
// - anything in between: partial.
function getOwnedBadgeInfo(ownership: EntryOwnership): { level: SatisfactionLevel; label: string } | null {
  const owned = ownership.ownedQuantity;
  const wished = ownership.nonOwnedListCount;
  let level: SatisfactionLevel;
  if (wished === 0) {
    return null;
  } else if (owned === 0) {
    level = "none";
  } else if (owned >= wished) {
    level = "complete";
  } else {
    level = "partial";
  }
  return { level, label: getLevelLabel(level, owned, wished) };
}

// Whether the badge for this ownership represents "complete". False where the badge shows any other or no level.
export function isCollectionComplete(ownership: EntryOwnership | null): boolean {
  return ownership !== null && getOwnedBadgeInfo(ownership)?.level === "complete";
}

// The ring or disc itself, in the corner of the tile's image.
function LevelBadge({ level, label }: { level: SatisfactionLevel; label: string }) {
  return (
    <span className={LEVEL_CLASS_NAMES[level]} role="img" aria-label={label} title={label}>
      {level === "complete" ? <CheckIcon /> : null}
    </span>
  );
}

// The badge on the bottom-right corner of a list tile: how much of what is wanted of the exact printing and edition on
// the tile is owned.
export function OwnedBadge({ ownership }: { ownership: EntryOwnership }) {
  const info = getOwnedBadgeInfo(ownership);
  if (info === null) {
    return null;
  }
  return <LevelBadge level={info.level} label={info.label} />;
}

// The badge on the bottom-right corner of a group's tile: how much of what the group asks for is covered by what is
// owned. A group is always wanted by its own list, so unlike an entry's badge it is always there. For a partly covered
// group the counts are those of the member that is closest to covered.
export function GroupSatisfactionBadge({ satisfaction }: { satisfaction: DemandSatisfaction }) {
  const label = getLevelLabel(satisfaction.level, satisfaction.ownedCount, satisfaction.wishedCount);
  return <LevelBadge level={satisfaction.level} label={label} />;
}