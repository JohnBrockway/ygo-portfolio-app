import { WISHLIST_LIST_ID } from "../data/listsDb";
import { BookmarkIcon, HeartIcon } from "./ActionIcons";

// The icon of a list in its role as the one-click list: the heart for Wishlist, a bookmark for any list of the user's
// own. Used by the one-click button and by the list picker, so both show the same thing. `filled` is for the "on" state
// (on the list, in the button; the chosen one, in the picker).
export function OneClickListIcon({ listId, filled }: { listId: string; filled: boolean }) {
  if (listId === WISHLIST_LIST_ID) {
    return <HeartIcon filled={filled} />;
  }
  return <BookmarkIcon filled={filled} />;
}