import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { ListEntryTile } from "../components/ListEntryTile";
import { ListMeta } from "../components/ListMeta";
import { SearchBar } from "../components/SearchBar";
import { buildFoundPrintingsById, joinRecordsWithMasterData } from "../data/foundPrintings";
import type { RecordWithFoundPrinting } from "../data/foundPrintings";
import { canChangeLists, getEntryOwnership, getListEntries, useLiveLists } from "../data/lists";
import type { EntryOwnership, ListsState } from "../data/lists";
import { OWNED_LIST_ID } from "../data/listsDb";
import type { ListEntryRecord } from "../data/listsDb";
import { loadMasterData } from "../data/masterData";
import { joinSearchTexts, matchesAllTokensInLowerText, splitQuery } from "../data/search";
import type { MasterData } from "../data/types";
import { useLoadOnMount } from "../data/useLoadOnMount";

// A list entry prepared for searching, with the lowercase text its filter matches against.
type SearchableListTile = {
  tile: RecordWithFoundPrinting<ListEntryRecord>;
  searchText: string;
};

// Built once per change to the list or data, not per keystroke.
function buildSearchableListTiles(tiles: readonly RecordWithFoundPrinting<ListEntryRecord>[]): SearchableListTile[] {
  return tiles.map((tile): SearchableListTile => {
    const { record, found } = tile;
    if (found === null) {
      // The tile shows the printing id in place of the name, so that is what the filter matches.
      return { tile, searchText: record.printingId.toLowerCase() };
    }
    // Synthetic set numbers aren't shown on tiles, so they aren't searchable.
    const numberText = found.setcode.set_number_synthetic ? "" : found.setcode.set_number.toLowerCase();
    return { tile, searchText: joinSearchTexts(numberText, found.card.title.toLowerCase()) };
  });
}

// What the owned badge on a list entry's tile shows, or null where the tile has no badge. The Owned list has none: the
// badge says how much of what the other lists want is owned, and on Owned the tile is the owned copies themselves.
function getTileOwnership(listsState: ListsState, record: ListEntryRecord): EntryOwnership | null {
  if (record.listId === OWNED_LIST_ID) {
    return null;
  }
  return getEntryOwnership(listsState, record.printingId, record.edition);
}

// The entries of a list as tiles, under a filter bar. The filter text is plain state of this component (not in the
// address bar); the caller keys this component by list so it starts empty again when another list is opened.
function ListContents({
  entries,
  data,
  listsState,
  changesDisabled,
}: {
  entries: readonly ListEntryRecord[];
  data: MasterData;
  listsState: ListsState;
  changesDisabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const tokens = useMemo(() => splitQuery(query), [query]);

  // Built once per data load, not per change to the list.
  const foundPrintingsById = useMemo(() => buildFoundPrintingsById(data), [data]);
  const tiles = useMemo(
    () => joinRecordsWithMasterData(entries, foundPrintingsById),
    [entries, foundPrintingsById],
  );
  const searchableTiles = useMemo(() => buildSearchableListTiles(tiles), [tiles]);

  if (tiles.length === 0) {
    return <p className="muted">Nothing on this list yet.</p>;
  }

  // Keeps the order the tiles are already in.
  const matchingTiles = searchableTiles
    .filter(({ searchText }) => matchesAllTokensInLowerText(searchText, tokens))
    .map(({ tile }) => tile);

  let results: ReactNode;
  if (matchingTiles.length === 0) {
    results = <p className="muted">No entries on this list match this search.</p>;
  } else {
    results = (
      <ul className="tile-grid tile-grid-cards">
        {matchingTiles.map((tile) => (
          <li key={`${tile.record.printingId}-${tile.record.edition}`}>
            <ListEntryTile
              listEntry={tile}
              ownership={getTileOwnership(listsState, tile.record)}
              changesDisabled={changesDisabled}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <SearchBar value={query} onChange={setQuery} label="Filter list by name or set number" />
      {results}
    </>
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
        <ListContents
          key={list.id}
          entries={entries}
          data={data}
          listsState={listsState}
          changesDisabled={changesDisabled}
        />
      </>
    );
  }

  return (
    <>
      {content}
    </>
  );
}