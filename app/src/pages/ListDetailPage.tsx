import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { ListEntryTile } from "../components/ListEntryTile";
import { ListMeta } from "../components/ListMeta";
import { buildFoundPrintingsById, joinEntriesWithMasterData } from "../data/listEntries";
import { getListEntries, useLiveLists } from "../data/lists";
import type { EntryRecord, ListRecord } from "../data/listsDb";
import { loadMasterData } from "../data/masterData";
import type { MasterData } from "../data/types";

function ListContents({
  list,
  entries,
  data,
  changesDisabled,
}: {
  list: ListRecord;
  entries: readonly EntryRecord[];
  data: MasterData;
  changesDisabled: boolean;
}) {
  // Built once per data load, not per change to the list.
  const foundPrintingsById = useMemo(() => buildFoundPrintingsById(data), [data]);
  const tiles = useMemo(
    () => joinEntriesWithMasterData(entries, foundPrintingsById),
    [entries, foundPrintingsById],
  );

  if (tiles.length === 0) {
    return <p className="muted">Nothing on this list yet.</p>;
  }

  return (
    <ul className="tile-grid tile-grid-cards">
      {tiles.map((tile) => (
        <li key={`${tile.entry.printingId}-${tile.entry.edition}`}>
          <ListEntryTile listEntry={tile} backLabel={list.name} changesDisabled={changesDisabled} />
        </li>
      ))}
    </ul>
  );
}

export function ListDetailPage() {
  const { listId } = useParams();
  const listsState = useLiveLists();
  const [data, setData] = useState<MasterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore the result if the page was left before the fetch finished.
    let cancelled = false;

    loadMasterData()
      .then((loadedData) => {
        if (!cancelled) {
          setData(loadedData);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const list = listsState.activeLists.find((candidate) => candidate.id === listId);
  const changesDisabled = listsState.status !== "ready";

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
        <p className="muted">No list matching this link.</p>
      </>
    );
  } else {
    const entries = getListEntries(listsState, list.id);
    content = (
      <>
        <h1>{list.name}</h1>
        <ListMeta list={list} entries={entries} />
        <ListContents list={list} entries={entries} data={data} changesDisabled={changesDisabled} />
      </>
    );
  }

  return (
    <>
      <p>
        <BackLink fallbackTo="/lists" fallbackLabel="Lists" />
      </p>
      {content}
    </>
  );
}