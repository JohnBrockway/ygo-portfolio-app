import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { canChangeLists, changeEntryQuantity, getEntryQuantity, useLiveLists } from "../data/lists";
import type { ListsState } from "../data/lists";
import { OWNED_LIST_ID } from "../data/listsDb";
import type { ListRecord } from "../data/listsDb";
import { setOneClickListId, useLiveOneClickList } from "../data/oneClickList";
import type { Edition } from "../data/types";
import { OneClickListIcon } from "./OneClickListIcon";

// The lists the dialog offers: every list except Owned, which has its own stepper (it holds copies, not on/off).
function getMenuLists(listsState: ListsState): ListRecord[] {
  return listsState.activeLists.filter((list) => list.id !== OWNED_LIST_ID);
}

// A modal with one checkbox per list, opened by AddToListButton. Everything that closes it goes through
// dialog.close(), so the browser handles Escape and returns focus to the button that opened it; onClosed then tells
// the button to unmount the dialog.
// A checkbox changes once the change has been saved, like the one-click button.
// Beside each checkbox is a button that makes that list the one the one-click button adds to (OneClickListButton).
export function AddToListDialog({
  cardId,
  printingId,
  edition,
  label,
  onClosed,
}: {
  cardId: string;
  printingId: string;
  edition: Edition;
  label: string;
  onClosed: () => void;
}) {
  const lists = useLiveLists();
  const oneClickList = useLiveOneClickList();
  const canChange = canChangeLists(lists);
  const menuLists = getMenuLists(lists);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Opened here, not with the `open` attribute, because only showModal makes it modal. The check is for React's
  // StrictMode, which runs effects twice in development.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  function closeDialog(): void {
    dialogRef.current?.close();
  }

  let createListsHint: ReactNode = null;
  if (menuLists.every((list) => list.builtIn)) {
    createListsHint = <p className="muted dialog-hint">Create your own lists on the Lists page.</p>;
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClosed}
      // A click on the backdrop lands on the dialog element itself; a click inside lands on something within it.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      <div className="dialog-body">
        <h2 id={titleId} className="dialog-title">
          Add to list <span className="muted">· {label}</span>
        </h2>
        <ul className="list-choices">
          {menuLists.map((list) => {
            const onList = getEntryQuantity(lists, list.id, printingId, edition) > 0;
            const isOneClickList = oneClickList?.id === list.id;
            const oneClickTitle = isOneClickList
              ? "The one-click button adds to this list"
              : "Make the one-click button add to this list";
            return (
              <li key={list.id} className="list-choice-row">
                <label className="list-choice">
                  <input
                    type="checkbox"
                    checked={onList}
                    disabled={!canChange}
                    // The desired state comes from what the checkbox shows, not the latest state (same as
                    // OneClickListButton), so a stale tap can't flip a change in an unexpected direction.
                    onChange={() =>
                      void changeEntryQuantity(list.id, cardId, printingId, edition, () => (onList ? 0 : 1))
                    }
                  />
                  <span>{list.name}</span>
                </label>
                <button
                  type="button"
                  className="action-button one-click-choice"
                  aria-label={`One-click list, ${list.name}`}
                  aria-pressed={isOneClickList}
                  title={oneClickTitle}
                  onClick={() => setOneClickListId(list.id)}
                >
                  <OneClickListIcon listId={list.id} filled={isOneClickList} />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="muted dialog-hint">
          The buttons decide which list the one-click button on each printing should add to.
        </p>
        {createListsHint}
        <button type="button" className="action-button" onClick={closeDialog}>
          Close
        </button>
      </div>
    </dialog>
  );
}