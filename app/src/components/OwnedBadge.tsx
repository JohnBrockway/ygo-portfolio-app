import type { EntryOwnership } from "../data/lists";
import { CheckIcon } from "./ActionIcons";

const OWNED_LABEL = "Owned";
const NOT_OWNED_LABEL = "Not owned";

type OwnedState = "none" | "partial" | "complete";

// The class names of each state: the base class is the ring every state has, and the other class changes how it is
// filled (see index.css).
const OWNED_CLASS_NAMES: Record<OwnedState, string> = {
  none: "tile-owned",
  partial: "tile-owned tile-owned-partial",
  complete: "tile-owned tile-owned-complete",
};

// How much of what the user wants of this printing and edition they own, and what to call it. The badge's look and its
// tooltip and aria-label all come from this one result, so they can't disagree.
// - nothing owned: none;
// - at least as many owned as wished: complete;
// - anything in between: partial.
function getOwnedBadgeInfo(ownership: EntryOwnership): { state: OwnedState; label: string } {
  const owned = ownership.ownedQuantity;
  const wished = ownership.nonOwnedListCount;
  if (owned === 0) {
    return { state: "none", label: NOT_OWNED_LABEL };
  } else if (owned >= wished) {
    return { state: "complete", label: OWNED_LABEL };
  } else {
    return { state: "partial", label: `${owned} out of ${wished} wished copies owned` };
  }
}

// The badge on the bottom-right corner of a list tile: how much of what is wanted of the exact printing and edition on
// the tile is owned.
export function OwnedBadge({ ownership }: { ownership: EntryOwnership }) {
  if (ownership.nonOwnedListCount === 0) {
    return null;
  }
  const { state, label } = getOwnedBadgeInfo(ownership);
  return (
    <span className={OWNED_CLASS_NAMES[state]} role="img" aria-label={label} title={label}>
      {state === "complete" ? <CheckIcon /> : null}
    </span>
  );
}