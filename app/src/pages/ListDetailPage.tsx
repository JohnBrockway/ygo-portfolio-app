import { useMemo } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { ListEntryTile } from "../components/ListEntryTile";
import { ListMeta } from "../components/ListMeta";
import { buildFoundPrintingsById, joinRecordsWithMasterData } from "../data/foundPrintings";
import { canChangeLists, getListEntries, useLiveLists } from "../data/lists";
import type { ListEntryRecord } from "../data/listsDb";
import { loadMasterData } from "../data/masterData";
import type { MasterData } from "../data/types";
import { useLoadOnMount } from "../data/useLoadOnMount";

function ListContents({
  entries,
  data,
  changesDisabled,
}: {
  entries: readonly ListEntryRecord[];
  data: MasterData;
  changesDisabled: boolean;
}) {
  // Built once per data load, not per change to the list.
  const foundPrintingsById = useMemo(() => buildFoundPrintingsById(data), [data]);
  const tiles = useMemo(
    () => joinRecordsWithMasterData(entries, foundPrintingsById),
    [entries, foundPrintingsById],
  );

  if (tiles.length === 0) {
    return <p className="muted">Nothing on this list yet.</p>;
  }

  return (
    <ul className="tile-grid tile-grid-cards">
      {tiles.map((tile) => (
        <li key={`${tile.record.printingId}-${tile.record.edition}`}>
          <ListEntryTile listEntry={tile} changesDisabled={changesDisabled} />
        </li>
      ))}
    </ul>
  );
}

export function ListDetailPage() {
  const { listId } = useParams();
  const listsState = useLiveLists();
  const { data, error } = useLoadOnMount(loadMasterData);

  const list = listsState.activeLists.find((candidate) => candidate.id === listId);
  const changesDisabled = !canChangeLists(listsState);

  let content: ReactNode;
  if (error !== null) {
    content = <p>Couldn't load list contents: {error}</p>;
  } else if (data === null || listsState.status === "loading") {
    content = <p className="muted">Loading list…</p>;
  } else if (list === undefined) {
    // Also what shows when the list was deleted in another tab, or after a failed load (the banner says why).
    content = (
      <>
        <h1>List not found</h1>
        <p className="muted">No list matches this address.</p>
      </>
    );
  } else {
    const entries = getListEntries(listsState, list.id);
    content = (
      <>
        <h1>{list.name}</h1>
        <ListMeta list={list} entries={entries} />
        <ListContents entries={entries} data={data} changesDisabled={changesDisabled} />
      </>
    );
  }

  return (
    <>
      {content}
    </>
  );
}