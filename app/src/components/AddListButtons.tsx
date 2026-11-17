import { useState } from "react";
import type { ChangeEvent } from "react";
import { addListToBinder } from "../data/binders";
import { canChangeLists, useLiveLists } from "../data/lists";

// A dropdown of the lists and an Add button after it, which adds everything on the chosen list to the binder's pool (cards
// the binder already has from that list are skipped, see addListToBinder). A dropdown rather than a button per list
// because there can be any number of lists. Disabled while the lists aren't ready, because the entries can't be trusted
// then.
export function AddListButtons({ binderId, changesDisabled }: { binderId: string; changesDisabled: boolean }) {
  const listsState = useLiveLists();
  // The list chosen in the dropdown, by id: "" while none is chosen. What counts is the list that has this id now (see
  // chosenList), so the id of a list that has gone (deleted here, or in another tab) is the same as no list chosen.
  const [chosenListId, setChosenListId] = useState("");
  const [adding, setAdding] = useState(false);

  const chosenList = listsState.activeLists.find((list) => list.id === chosenListId) ?? null;
  const listsDisabled = changesDisabled || !canChangeLists(listsState) || adding;

  function handleChooseList(event: ChangeEvent<HTMLSelectElement>) {
    setChosenListId(event.target.value);
  }

  async function handleAddChosenList() {
    // The button that calls this is disabled while no list is chosen.
    if (chosenList === null) {
      return;
    }

    setAdding(true);
    await addListToBinder(binderId, chosenList.id);
    // On success the cards show up in the pool; on failure the banner explains. The list stays chosen either way.
    setAdding(false);
  }

  const addButtonLabel =
    chosenList === null
      ? "Add everything on the chosen list to this binder"
      : `Add everything on ${chosenList.name} to this binder`;

  return (
    <div className="binder-add-list">
      <select
        className="binder-add-list-select"
        aria-label="List to add to this binder"
        value={chosenList === null ? "" : chosenList.id}
        disabled={listsDisabled}
        onChange={handleChooseList}
      >
        <option value="">Add contents of list</option>
        {listsState.activeLists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </select>
      <button
        className="action-button"
        type="button"
        aria-label={addButtonLabel}
        disabled={listsDisabled || chosenList === null}
        onClick={handleAddChosenList}
      >
        Add
      </button>
    </div>
  );
}