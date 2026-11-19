import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { ListEntryTile } from "../components/ListEntryTile";
import { ListMeta } from "../components/ListMeta";
import { isCollectionComplete } from "../components/OwnedBadge";
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

// A list entry prepared for filtering: the lowercase text the search filter matches against, and its ownership looked up
// once. The tile's badge and the "Unowned" filter both read the ownership, so neither repeats the lookup.
type ListTileEntry = {
  tile: RecordWithFoundPrinting<ListEntryRecord>;
  searchText: string;
  ownership: EntryOwnership | null;
  allRequiredCopiesOwned: boolean;
};

// What the owned badge on a list entry's tile shows, or null where the tile has no badge. The Owned list has none: the
// badge says how much of what the other lists want is owned, and on Owned the tile is the owned copies themselves.
function getTileOwnership(listsState: ListsState, record: ListEntryRecord): EntryOwnership | null {
  if (record.listId === OWNED_LIST_ID) {
    return null;
  }
  return getEntryOwnership(listsState, record.printingId, record.edition);
}

// The text a tile's search filter matches against.
function getTileSearchText({ record, found }: RecordWithFoundPrinting<ListEntryRecord>): string {
  if (found === null) {
    // The tile shows the printing id in place of the name, so that is what the filter matches.
    return record.printingId.toLowerCase();
  }
  // Synthetic set numbers aren't shown on tiles, so they aren't searchable.
  const numberText = found.setcode.set_number_synthetic ? "" : found.setcode.set_number.toLowerCase();
  return joinSearchTexts(numberText, found.card.title.toLowerCase());
}

// Prepares every tile for filtering, keeping the order. Built once per change to lists, the list, or the data, not
// per keystroke.
function buildListTileEntries(
  tiles: readonly RecordWithFoundPrinting<ListEntryRecord>[],
  listsState: ListsState,
): ListTileEntry[] {
  return tiles.map((tile): ListTileEntry => {
    const ownership = getTileOwnership(listsState, tile.record);
    return {
      tile,
      searchText: getTileSearchText(tile),
      ownership,
      allRequiredCopiesOwned: isCollectionComplete(ownership),
    };
  });
}

// The entries of a list as tiles, under a filter bar and, where it applies, the ownership toggle. The filter text and the
// toggle are plain state of this component (not in the address bar); the caller keys this component by list so they
// start out cleared again when another list is opened. An entry shows when it passes both filters.
function ListContents({
  entries,
  data,
  listsState,
  changesDisabled,
  canFilterByOwnership,
}: {
  entries: readonly ListEntryRecord[];
  data: MasterData;
  listsState: ListsState;
  changesDisabled: boolean;
  // False on the Owned list, whose tiles have no ownership to filter by.
  canFilterByOwnership: boolean;
}) {
  const [query, setQuery] = useState("");
  const [unownedOnly, setUnownedOnly] = useState(false);
  const tokens = useMemo(() => splitQuery(query), [query]);

  // Built once per data load, not per change to the list.
  const foundPrintingsById = useMemo(() => buildFoundPrintingsById(data), [data]);
  const tiles = useMemo(
    () => joinRecordsWithMasterData(entries, foundPrintingsById),
    [entries, foundPrintingsById],
  );
  const tileEntries = useMemo(() => buildListTileEntries(tiles, listsState), [tiles, listsState]);

  if (tiles.length === 0) {
    return <p className="muted">Nothing on this list yet.</p>;
  }

  // Keeps the order the tiles are already in. "Unowned" hides only the fully owned tiles, so unowned and partly owned
  // ones stay.
  const matchingTiles = tileEntries.filter(
    ({ searchText, allRequiredCopiesOwned }) =>
      !(unownedOnly && allRequiredCopiesOwned) && matchesAllTokensInLowerText(searchText, tokens),
  );

  let results: ReactNode;
  if (matchingTiles.length === 0) {
    results = <p className="muted">No entries on this list match these filters.</p>;
  } else {
    results = (
      <ul className="tile-grid tile-grid-cards">
        {matchingTiles.map(({ tile, ownership }) => (
          <li key={`${tile.record.printingId}-${tile.record.edition}`}>
            <ListEntryTile listEntry={tile} ownership={ownership} changesDisabled={changesDisabled} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <SearchBar value={query} onChange={setQuery} label="Filter list by name or set number" />
      {canFilterByOwnership ? (
        <label
          className="ownership-filter"
          title="Unowned hides entries where you already own every wished copy"
        >
          <span>All</span>
          <input
            type="checkbox"
            role="switch"
            checked={unownedOnly}
            onChange={(event) => setUnownedOnly(event.target.checked)}
            aria-label="Hide fully owned entries"
          />
          <span>Unowned</span>
        </label>
      ) : null}
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
          canFilterByOwnership={list.id !== OWNED_LIST_ID}
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