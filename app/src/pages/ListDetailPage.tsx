import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { CollapseRaritiesButton } from "../components/CollapseRaritiesButton";
import { EntryGroupContainer } from "../components/EntryGroupContainer";
import { GroupTile } from "../components/GroupTile";
import { ListEntryTile } from "../components/ListEntryTile";
import { ListMeta } from "../components/ListMeta";
import { ListSelectionBar } from "../components/ListSelectionBar";
import type { ListSelection } from "../components/ListSelectionBar";
import { isCollectionComplete } from "../components/OwnedBadge";
import { SearchBar } from "../components/SearchBar";
import { SelectButton } from "../components/SelectButton";
import { getDemandSatisfaction, getGroupDemandKey } from "../data/demandSatisfaction";
import type { DemandSatisfaction } from "../data/demandSatisfaction";
import { editionLabel } from "../data/editions";
import type { EntryGroup } from "../data/entryGroups";
import { buildFoundPrintingsById, getRecordName, joinRecordsWithMasterData } from "../data/foundPrintings";
import type { RecordWithFoundPrinting } from "../data/foundPrintings";
import { canChangeLists, getEntryOwnership, getListEntries, getListGroups, useLiveLists } from "../data/lists";
import type { EntryOwnership, ListsState } from "../data/lists";
import { getEntryKey, OWNED_LIST_ID } from "../data/listsDb";
import type { ListEntryRecord } from "../data/listsDb";
import { loadMasterData } from "../data/masterData";
import { printingName } from "../data/printings";
import { joinSearchTexts, matchesAllTokensInLowerText, splitQuery } from "../data/search";
import type { TileSelection } from "../data/tileSelection";
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

// One thing on the page: a plain entry, or a live group with its members. A plain entry has `group` null and its one
// tile entry; a group has its members' tile entries, in the order they are shown in. There is always at least one.
interface ListDisplayItem {
  group: EntryGroup | null;
  tileEntries: [ListTileEntry, ...ListTileEntry[]];
}

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

// Turns the tile entries (in the order they are shown) into what the page shows: plain entries and live groups. A group
// is placed where its first member is, and has its members in the order they come in. An entry whose group has no other
// member (a survivor) is not in a live group, so it is a plain entry.
function buildListDisplayItems(
  tileEntries: readonly ListTileEntry[],
  groups: readonly EntryGroup[],
): ListDisplayItem[] {
  const groupsById = new Map(groups.map((group): [string, EntryGroup] => [group.groupId, group]));
  const itemsByGroupId = new Map<string, ListDisplayItem>();
  const items: ListDisplayItem[] = [];
  for (const tileEntry of tileEntries) {
    const { groupId } = tileEntry.tile.record;
    const group = groupId === null ? undefined : groupsById.get(groupId);
    if (group === undefined) {
      items.push({ group: null, tileEntries: [tileEntry] });
      continue;
    }
    const groupItem = itemsByGroupId.get(group.groupId);
    if (groupItem === undefined) {
      const newItem: ListDisplayItem = { group, tileEntries: [tileEntry] };
      itemsByGroupId.set(group.groupId, newItem);
      items.push(newItem);
    } else {
      groupItem.tileEntries.push(tileEntry);
    }
  }
  return items;
}

// What tells an entry apart from the others on the page. Its list is the page's, so the rest of its key is enough.
function getTileKey(record: ListEntryRecord): string {
  return `${record.cardId}-${record.printingId}-${record.edition}`;
}

// The title of a group: its first member's name and how many more there are, like "Dark Magician +2".
function getGroupTitle(tileEntries: readonly [ListTileEntry, ...ListTileEntry[]]): string {
  const [first] = tileEntries;
  return `${getRecordName(first.tile)} +${tileEntries.length - 1}`;
}

// What the header of an open group says covers it: the member that carries it (satisfiedBy, see DemandSatisfaction), by
// name, printing and edition, or null where nothing carries the group.
function getSatisfiedByDescription(
  tileEntries: readonly [ListTileEntry, ...ListTileEntry[]],
  satisfiedBy: string | null,
): string | null {
  if (satisfiedBy === null) {
    return null;
  }
  const carrier = tileEntries.find(({ tile }) => getEntryKey(tile.record) === satisfiedBy);
  if (carrier === undefined) {
    throw new Error(`A group is satisfied by "${satisfiedBy}", which is not one of its members`);
  }
  const { record, found } = carrier.tile;
  const edition = editionLabel(record.edition);
  if (found === null) {
    return `${record.printingId} (${edition})`;
  }
  return `${found.card.title}, ${printingName(found.printing, found.setcode.printings)} (${edition})`;
}

function getGroupSatisfaction(
  satisfactions: ReadonlyMap<string, DemandSatisfaction>,
  group: EntryGroup,
): DemandSatisfaction {
  const satisfaction = satisfactions.get(getGroupDemandKey(group));
  if (satisfaction === undefined) {
    throw new Error(`No satisfaction was worked out for group "${group.groupId}" of list "${group.listId}"`);
  }
  return satisfaction;
}

// What is selected now, sorted by kind. It is worked out from everything on the list, not only from what the filters
// show, so entries picked under one search stay picked under the next, and an entry that is gone or has changed
// groups is counted as what it is now.
function getListSelection(
  items: readonly ListDisplayItem[],
  selectedEntryKeys: ReadonlySet<string>,
  selectedGroupIds: ReadonlySet<string>,
): ListSelection {
  const selection: ListSelection = { plainEntries: [], memberEntries: [], groups: [] };
  for (const item of items) {
    const selectedEntries = item.group === null ? selection.plainEntries : selection.memberEntries;
    for (const { tile } of item.tileEntries) {
      if (selectedEntryKeys.has(getTileKey(tile.record))) {
        selectedEntries.push(tile.record);
      }
    }
    if (item.group !== null && selectedGroupIds.has(item.group.groupId)) {
      selection.groups.push(item.group);
    }
  }
  return selection;
}

// A copy of the set with the value taken out if it was in, or put in if it wasn't.
function toggledSet(set: ReadonlySet<string>, value: string): Set<string> {
  const toggled = new Set(set);
  if (toggled.has(value)) {
    toggled.delete(value);
  } else {
    toggled.add(value);
  }
  return toggled;
}

// The entries of a list as tiles, under a filter bar and, where it applies, a toolbar with the ownership toggle and the
// button that collapses rarities (which works on the whole list, not only on what the filters show), and a floating
// button that starts select mode (while in select mode the selection bar is shown instead, with its own button to leave
// it). A group is one tile that opens, in place, into a container around the tiles of its members. In select mode every
// group is open and can't be folded up, so what is picked is always picked in containers and member tiles; when select
// mode ends, all groups are folded up again. The filter text, the toggle, which groups are open and the selection are
// plain state of this component (not in the address bar); the caller keys this component by list so they start out
// cleared again when another list is opened. An entry shows when it passes both filters. A group shows, with all its
// members, when any of them passes the search, and, with the "Unowned" switch on, unless what is owned covers it
// completely.
function ListContents({
  listId,
  entries,
  groups,
  data,
  listsState,
  changesDisabled,
}: {
  listId: string;
  entries: readonly ListEntryRecord[];
  groups: readonly EntryGroup[];
  data: MasterData;
  listsState: ListsState;
  changesDisabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [unownedOnly, setUnownedOnly] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedEntryKeys, setSelectedEntryKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<ReadonlySet<string>>(() => new Set());
  const [expandedGroupIds, setExpandedGroupIds] = useState<ReadonlySet<string>>(() => new Set());
  const tokens = useMemo(() => splitQuery(query), [query]);

  // Built once per data load, not per change to the list.
  const foundPrintingsById = useMemo(() => buildFoundPrintingsById(data), [data]);
  const tiles = useMemo(
    () => joinRecordsWithMasterData(entries, foundPrintingsById),
    [entries, foundPrintingsById],
  );
  const tileEntries = useMemo(() => buildListTileEntries(tiles, listsState), [tiles, listsState]);
  const displayItems = useMemo(() => buildListDisplayItems(tileEntries, groups), [tileEntries, groups]);

  if (tiles.length === 0) {
    return <p className="muted">Nothing on this list yet.</p>;
  }

  // Groups only exist on the other lists: Owned holds real copies, so "any of these" makes no sense there.
  const isOwnedList = listId === OWNED_LIST_ID;

  // Worked out once per change to lists (see getDemandSatisfaction), so this is a lookup, not a calculation.
  const satisfactions = getDemandSatisfaction(listsState);

  function matchesSearch({ searchText }: ListTileEntry): boolean {
    return matchesAllTokensInLowerText(searchText, tokens);
  }

  // Keeps the order the items are already in. "Unowned" hides only the fully owned entries, and the groups that what is
  // owned covers completely, so unowned and partly owned ones stay.
  const visibleItems = displayItems.filter((item) => {
    if (item.group !== null) {
      const covered = getGroupSatisfaction(satisfactions, item.group).level === "complete";
      return !(unownedOnly && covered) && item.tileEntries.some(matchesSearch);
    }
    const [tileEntry] = item.tileEntries;
    return !(unownedOnly && tileEntry.allRequiredCopiesOwned) && matchesSearch(tileEntry);
  });

  function clearSelection() {
    setSelectedEntryKeys(new Set());
    setSelectedGroupIds(new Set());
  }

  function handleExitSelectMode() {
    // What was picked is let go of when select mode ends, and the groups that select mode opened are folded up again.
    clearSelection();
    setExpandedGroupIds(new Set());
    setSelectMode(false);
  }

  // How a tile is picked in select mode, or null outside it.
  function getEntrySelection(record: ListEntryRecord): TileSelection | null {
    if (!selectMode) {
      return null;
    }
    const key = getTileKey(record);
    return {
      isSelected: selectedEntryKeys.has(key),
      onToggle: () => setSelectedEntryKeys((current) => toggledSet(current, key)),
    };
  }

  // How a group as a whole is picked in select mode, or null outside it.
  function getGroupSelection(groupId: string): TileSelection | null {
    if (!selectMode) {
      return null;
    }
    return {
      isSelected: selectedGroupIds.has(groupId),
      onToggle: () => setSelectedGroupIds((current) => toggledSet(current, groupId)),
    };
  }

  function renderTile(tileEntry: ListTileEntry): ReactNode {
    return (
      <li key={getTileKey(tileEntry.tile.record)}>
        <ListEntryTile
          listEntry={tileEntry.tile}
          ownership={tileEntry.ownership}
          changesDisabled={changesDisabled}
          selection={getEntrySelection(tileEntry.tile.record)}
        />
      </li>
    );
  }

  function handleToggleGroupExpanded(groupId: string) {
    setExpandedGroupIds((current) => toggledSet(current, groupId));
  }

  // Opens exactly the groups that collapsing rarities made or added to, and folds up every other one, so the groups that
  // are open afterwards are the ones the operation handled.
  function handleReviewGroups(groupIds: readonly string[]) {
    setExpandedGroupIds(new Set(groupIds));
  }

  // A group is one tile, or, once opened (and always in select mode), the container with the tiles of all its members in
  // it.
  function renderGroup(group: EntryGroup, groupTileEntries: readonly [ListTileEntry, ...ListTileEntry[]]): ReactNode {
    const title = getGroupTitle(groupTileEntries);
    const satisfaction = getGroupSatisfaction(satisfactions, group);
    if (!selectMode && !expandedGroupIds.has(group.groupId)) {
      return (
        <li key={`group-${group.groupId}`}>
          <GroupTile
            title={title}
            tiles={groupTileEntries.map(({ tile }) => tile)}
            satisfaction={satisfaction}
            onExpand={() => handleToggleGroupExpanded(group.groupId)}
          />
        </li>
      );
    }
    return (
      <li key={`group-${group.groupId}`} className="entry-group-item">
        <EntryGroupContainer
          title={title}
          coveredBy={getSatisfiedByDescription(groupTileEntries, satisfaction.satisfiedBy)}
          selection={getGroupSelection(group.groupId)}
          onCollapse={() => handleToggleGroupExpanded(group.groupId)}
        >
          <ul className="tile-grid tile-grid-cards">{groupTileEntries.map(renderTile)}</ul>
        </EntryGroupContainer>
      </li>
    );
  }

  let results: ReactNode;
  if (visibleItems.length === 0) {
    results = <p className="muted">No entries on this list match these filters.</p>;
  } else {
    results = (
      <ul className="tile-grid tile-grid-cards">
        {visibleItems.map((item) => {
          if (item.group === null) {
            return renderTile(item.tileEntries[0]);
          }
          return renderGroup(item.group, item.tileEntries);
        })}
      </ul>
    );
  }

  let listToolbar: ReactNode = null;
  if (!isOwnedList) {
    listToolbar = (
      <div className="list-toolbar">
        <label
          className="ownership-filter"
          title="Unowned hides entries where you already own every wished copy, and groups that what you own covers"
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
        <CollapseRaritiesButton
          listId={listId}
          entries={tiles}
          groups={groups}
          changesDisabled={changesDisabled}
          onReview={handleReviewGroups}
        />
      </div>
    );
  }

  // In select mode the selection bar is what leaves it, so the button is only there outside it.
  let selectButton: ReactNode = null;
  if (!isOwnedList && !selectMode) {
    selectButton = <SelectButton onClick={() => setSelectMode(true)} />;
  }

  let selectionBar: ReactNode = null;
  if (selectMode) {
    selectionBar = (
      <ListSelectionBar
        listId={listId}
        selection={getListSelection(displayItems, selectedEntryKeys, selectedGroupIds)}
        changesDisabled={changesDisabled}
        onSaved={clearSelection}
        onExitSelectMode={handleExitSelectMode}
      />
    );
  }

  return (
    <>
      <SearchBar value={query} onChange={setQuery} label="Filter list by name or set number" />
      {listToolbar}
      {selectionBar}
      {results}
      {selectButton}
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
          listId={list.id}
          entries={entries}
          groups={getListGroups(listsState, list.id)}
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