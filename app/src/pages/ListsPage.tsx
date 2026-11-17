import type { ReactNode } from "react";
import { ListMeta } from "../components/ListMeta";
import { NameForm } from "../components/NameForm";
import { SummaryRow } from "../components/SummaryRow";
import { canChangeLists, createList, deleteList, getListEntries, renameList, useLiveLists } from "../data/lists";
import type { ListEntryRecord, ListRecord } from "../data/listsDb";

function ListSummaryRow({
  list,
  entries,
  changesDisabled,
}: {
  list: ListRecord;
  entries: readonly ListEntryRecord[];
  changesDisabled: boolean;
}) {
  return (
    <SummaryRow
      noun="list"
      name={list.name}
      meta={<ListMeta list={list} entries={entries} />}
      openTo={`/lists/${list.id}`}
      builtIn={list.builtIn}
      editable={!list.builtIn}
      changesDisabled={changesDisabled}
      deleteConsequence="Will not affect card status on any other list."
      renameRecord={(name) => renameList(list.id, name)}
      deleteRecord={() => deleteList(list.id)}
    />
  );
}

function NewListForm({ disabled }: { disabled: boolean }) {
  return (
    <NameForm
      noun="list"
      initialName=""
      label="New list name"
      submitText="Create list"
      disabled={disabled}
      save={createList}
    />
  );
}

export function ListsPage() {
  const listsState = useLiveLists();
  const changesDisabled = !canChangeLists(listsState);

  let content: ReactNode;
  if (listsState.status === "loading") {
    content = <p className="muted">Loading lists…</p>;
  } else if (listsState.activeLists.length === 0) {
    // Only possible after a failed load (the built-in lists always exist otherwise); the banner says why.
    content = <p className="muted">No lists to show.</p>;
  } else {
    content = (
      <ul className="row-list">
        {listsState.activeLists.map((list) => (
          <li key={list.id}>
            <ListSummaryRow
              list={list}
              entries={getListEntries(listsState, list.id)}
              changesDisabled={changesDisabled}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <h1>Lists</h1>
      <NewListForm disabled={changesDisabled} />
      {content}
    </>
  );
}