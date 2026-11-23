import { useState } from "react";
import type { ReactNode } from "react";
import { canChangeLists, getEntryQuantity, useLiveLists } from "../data/lists";
import { OWNED_LIST_ID } from "../data/listsDb";
import { useLiveOneClickList } from "../data/oneClickList";
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

// Button next to the one-click button (OneClickListButton) that opens the list picker (AddToListDialog) for this
// printing's edition. It is tinted when the edition is on a list that nothing else on the cell shows: any list except
// Owned (which has its own stepper) and the one-click list (whose button shows its own state).
// Takes the same props as OneClickListButton.
export function AddToListButton({
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const isOnListBesidesOneClick = lists.activeLists.some(
    (list) =>
      list.id !== OWNED_LIST_ID &&
      list.id !== oneClickList?.id &&
      getEntryQuantity(lists, list.id, printingId, edition) > 0,
  );

  let dialog: ReactNode = null;
  if (dialogOpen) {
    dialog = (
      <AddToListDialog
        cardId={cardId}
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
        className={`action-button list-button list-menu-trigger${isOnListBesidesOneClick ? " list-menu-trigger-on" : ""}`}
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