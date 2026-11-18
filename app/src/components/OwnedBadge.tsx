import type { EntryOwnership } from "../data/lists";
import { CheckIcon } from "./ActionIcons";

const OWNED_LABEL = "Owned";
const NOT_OWNED_LABEL = "Not owned";

// The badge on the bottom-right corner of a list tile: whether the exact printing and edition on the tile is owned.
export function OwnedBadge({ ownership }: { ownership: EntryOwnership }) {
  if (ownership.nonOwnedListCount === 0) {
    return null;
  } else if (ownership.ownedQuantity >= 1) {
    return (
      <span className="tile-owned tile-owned-complete" role="img" aria-label={OWNED_LABEL} title={OWNED_LABEL}>
        <CheckIcon />
      </span>
    );
  } else {
    return <span className="tile-owned" role="img" aria-label={NOT_OWNED_LABEL} title={NOT_OWNED_LABEL} />;
  }
}