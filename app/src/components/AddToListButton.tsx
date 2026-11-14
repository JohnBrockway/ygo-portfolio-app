import { useState } from "react";
import type { ReactNode } from "react";
import { canChangeLists, getEntryQuantity, useLiveLists } from "../data/lists";
import type { Edition } from "../data/types";
import { AddToListDialog } from "./AddToListDialog";
import { Icon } from "./Icon";

function ListPlusIcon() {
  return (
    <Icon filled={false}>
      <path d="M4 6h12M4 12h8M4 18h8M18 13v6M15 16h6" />
    </Icon>
  );
}

// Button next to the wishlist heart that opens the list picker (AddToListDialog) for this printing's edition. It is
// tinted when the edition is on any list of the user's own (the heart already shows Wishlist).
// Takes the same props as WishlistButton.
export function AddToListButton({
  printingId,
  edition,
  label,
}: {
  printingId: string;
  edition: Edition;
  label: string;
}) {
  const lists = useLiveLists();
  const [dialogOpen, setDialogOpen] = useState(false);
  const isOnAnyCustomList = lists.activeLists.some(
    (list) => !list.builtIn && getEntryQuantity(lists, list.id, printingId, edition) > 0,
  );

  let dialog: ReactNode = null;
  if (dialogOpen) {
    dialog = (
      <AddToListDialog
        printingId={printingId}
        edition={edition}
        label={label}
        onClosed={() => setDialogOpen(false)}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        className={`action-button list-button list-menu-trigger${isOnAnyCustomList ? " list-menu-trigger-on" : ""}`}
        aria-label={`More lists, ${label}`}
        aria-haspopup="dialog"
        disabled={!canChangeLists(lists)}
        onClick={() => setDialogOpen(true)}
      >
        <ListPlusIcon />
      </button>
      {dialog}
    </>
  );
}