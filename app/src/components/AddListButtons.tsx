import { useState } from "react";
import { addListToBinder } from "../data/binders";
import { canChangeLists, useLiveLists } from "../data/lists";

// One button per list, each adding everything on that list to the binder's pool (cards the binder already has from that
// list are skipped, see addListToBinder). Disabled while the lists aren't ready, because the entries can't be trusted
// then.
export function AddListButtons({ binderId, changesDisabled }: { binderId: string; changesDisabled: boolean }) {
  const listsState = useLiveLists();
  const [addingListId, setAddingListId] = useState<string | null>(null);

  const disabled = changesDisabled || !canChangeLists(listsState) || addingListId !== null;

  async function handleAddList(listId: string) {
    setAddingListId(listId);
    await addListToBinder(binderId, listId);
    // On success the cards show up in the pool; on failure the banner explains.
    setAddingListId(null);
  }

  return (
    <div className="binder-pool-lists">
      <span className="muted">Add everything on a list:</span>
      {listsState.activeLists.map((list) => (
        <button
          key={list.id}
          className="action-button"
          type="button"
          aria-label={`Add everything on ${list.name} to this binder`}
          disabled={disabled}
          onClick={() => handleAddList(list.id)}
        >
          {list.name}
        </button>
      ))}
    </div>
  );
}