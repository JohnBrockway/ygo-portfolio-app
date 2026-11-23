import { canChangeLists, changeEntryQuantity, getEntryQuantity, useLiveLists } from "../data/lists";
import { WISHLIST_LIST_ID } from "../data/listsDb";
import { useLiveOneClickList } from "../data/oneClickList";
import type { Edition } from "../data/types";
import { OneClickListIcon } from "./OneClickListIcon";

// One-click toggle for this printing's edition on the one-click list: Wishlist unless the user picked another list in
// AddToListDialog. The icon says which (a heart for Wishlist, a bookmark for any other list), and changes once the
// change has been saved. Sits next to AddToListButton in EditionCells and takes the same props.
export function OneClickListButton({
  cardId,
  printingId,
  edition,
  label,
}: {
  cardId: string;
  printingId: string;
  edition: Edition;
  label: string;
}) {
  const lists = useLiveLists();
  const oneClickList = useLiveOneClickList();

  if (oneClickList === null) {
    // The lists haven't loaded, so there is no list to show yet. An empty, disabled button keeps the cell's layout.
    return <button type="button" className="action-button list-button" aria-label={`One-click list, ${label}`} disabled />;
  }

  const canChange = canChangeLists(lists);
  const onList = getEntryQuantity(lists, oneClickList.id, printingId, edition) > 0;
  const isWishlist = oneClickList.id === WISHLIST_LIST_ID;

  return (
    <button
      type="button"
      className={`action-button list-button${isWishlist ? "" : " list-button-custom"}`}
      aria-label={`${oneClickList.name}, ${label}`}
      title={oneClickList.name}
      aria-pressed={onList}
      disabled={!canChange}
      // The desired state comes from what the button shows, not the latest state, so a stale tap
      // won't flip a change in an unexpected direction. It will always set it to the state
      // expected from the button UI.
      onClick={() =>
        void changeEntryQuantity(oneClickList.id, cardId, printingId, edition, () => (onList ? 0 : 1))
      }
    >
      <OneClickListIcon listId={oneClickList.id} filled={onList} />
    </button>
  );
}