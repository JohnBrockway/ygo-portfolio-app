import { changeEntryQuantity, getEntryQuantity, useLiveLists } from "../data/lists";
import { WISHLIST_LIST_ID } from "../data/listsDb";
import type { Edition } from "../data/types";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3 5 6.5 5c2 0 3.7 1.1 5.5 3.2C13.8 6.1 15.5 5 17.5 5 21 5 22.8 8.6 21.5 11.8 19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

// One-click wishlist toggle for this printing's edition. The heart changes once the change has been saved.
// Takes the same props as the future AddToListMenu, which will replace it in EditionCells.
export function WishlistButton({
  printingId,
  edition,
  label,
}: {
  printingId: string;
  edition: Edition;
  label: string;
}) {
  const lists = useLiveLists();
  const isReady = lists.status === "ready";
  const onWishlist = getEntryQuantity(lists, WISHLIST_LIST_ID, printingId, edition) > 0;

  return (
    <button
      type="button"
      className="action-button list-button"
      aria-label={`Wishlist, ${label}`}
      aria-pressed={onWishlist}
      disabled={!isReady}
      // The desired state comes from what the button shows, not the latest state, so a stale tap
      // won't flip a change in an unexpected direction. It will always set it to the state
      // expected from the button UI.
      onClick={() => void changeEntryQuantity(WISHLIST_LIST_ID, printingId, edition, () => (onWishlist ? 0 : 1))}
    >
      <HeartIcon filled={onWishlist} />
    </button>
  );
}