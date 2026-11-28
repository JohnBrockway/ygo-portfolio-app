import { pickGroupIdForEntries } from "./entryGroups";
import type { EntryGroup } from "./entryGroups";
import type { RecordWithFoundPrinting } from "./foundPrintings";
import { getEntryKey } from "./listsDb";
import type { GroupAssignment, ListEntryRecord } from "./listsDb";
import { cleanLabel } from "./printings";

// Collapsing rarities: putting the entries of a list that are the same printing in the same artwork, and differ only by
// rarity, into groups. This file works out what that would change; saving it is up to the caller (see setEntriesGroups).

// One group that collapsing rarities makes or adds to.
export interface RarityGroupChange {
  groupId: string;
  // The members the group already has: none for a new group, otherwise the members of a group made by an earlier collapse.
  existingMembers: RecordWithFoundPrinting<ListEntryRecord>[];
  // The entries that join the group. There is always at least one.
  addedEntries: [RecordWithFoundPrinting<ListEntryRecord>, ...RecordWithFoundPrinting<ListEntryRecord>[]];
}

// Everything collapsing rarities on a list would do. `changes` is empty when there is nothing to collapse.
export interface RarityCollapse {
  changes: RarityGroupChange[];
  // What to save to do it, and what to save to put every entry it touches back in the group it was in before.
  assignments: GroupAssignment[];
  undoAssignments: GroupAssignment[];
  // Entries that couldn't be looked at because the master data doesn't have their printing, or the printing has no
  // artwork (an unverified printing). Entries that are in a live group already are not counted: they are left alone.
  unmatchableEntryCount: number;
}

// What makes two entries collapse into one group: the same setcode (which is the same card, set and set number), the
// same artwork, the same edition and the same label. Rarity is the one thing left out. Null for an entry that can't be
// compared: one whose printing isn't in the master data, or has no artwork.
function getRarityMatchKey({ record, found }: RecordWithFoundPrinting<ListEntryRecord>): string | null {
  if (found === null || found.printing.artwork === null) {
    return null;
  }
  return JSON.stringify([
    found.setcode.setcode_id,
    found.printing.artwork,
    record.edition,
    cleanLabel(found.printing.label),
  ]);
}

// The entries of a live group, as they are on the list. A group is made out of the list's own entries, so each of them
// is among them.
function findMemberEntries(
  group: EntryGroup,
  entriesByKey: ReadonlyMap<string, RecordWithFoundPrinting<ListEntryRecord>>,
): RecordWithFoundPrinting<ListEntryRecord>[] {
  return group.members.map((member) => {
    const memberEntry = entriesByKey.get(getEntryKey(member));
    if (memberEntry === undefined) {
      throw new Error(`Group "${group.groupId}" has a member that is not among the entries of list "${group.listId}"`);
    }
    return memberEntry;
  });
}

// The match key that all the members of a group share, or null when they don't share one: a group put together by hand
// can hold anything, and collapsing rarities leaves those alone.
function getGroupMatchKey(members: readonly RecordWithFoundPrinting<ListEntryRecord>[]): string | null {
  let sharedKey: string | null = null;
  for (const member of members) {
    const key = getRarityMatchKey(member);
    if (key === null || (sharedKey !== null && key !== sharedKey)) {
      return null;
    }
    sharedKey = key;
  }
  return sharedKey;
}

// The assignments that put every entry the changes add back in the group it was in before (none, or the group id of a
// survivor, see entryGroups.ts).
function getUndoAssignments(changes: readonly RarityGroupChange[]): GroupAssignment[] {
  const entriesByPreviousGroupId = new Map<string | null, ListEntryRecord[]>();
  for (const change of changes) {
    for (const { record } of change.addedEntries) {
      const entriesWithGroupId = entriesByPreviousGroupId.get(record.groupId);
      if (entriesWithGroupId === undefined) {
        entriesByPreviousGroupId.set(record.groupId, [record]);
      } else {
        entriesWithGroupId.push(record);
      }
    }
  }
  return [...entriesByPreviousGroupId].map(([groupId, entries]): GroupAssignment => ({ entries, groupId }));
}

// Works out what collapsing rarities does on a list. `entries` are all the entries of the list (not only those showing
// right now given the filters), joined to the master data, and `groups` are the list's live groups.
//
// Only plain entries and survivors take part (see entryGroups.ts): an entry in a live group stays where it is. Entries
// that match each other form a cluster, and:
// - a cluster takes the group id of a live group whose members all match it (one an earlier collapse made), however
//   few entries it has, so pressing the button again adds what is new to that group;
// - otherwise a cluster of two or more becomes a new group (taking over the id of a survivor if exactly one of its
//   entries is one, see pickGroupIdForEntries);
// - otherwise a single entry stays as it is.
// If two live groups match the same entries, the one whose first member comes first takes them.
export function planRarityCollapse(
  entries: readonly RecordWithFoundPrinting<ListEntryRecord>[],
  groups: readonly EntryGroup[],
): RarityCollapse {
  const entriesByKey = new Map(
    entries.map((entry): [string, RecordWithFoundPrinting<ListEntryRecord>] => [getEntryKey(entry.record), entry]),
  );
  const liveGroupIds = new Set(groups.map((group) => group.groupId));

  const groupsByMatchKey = new Map<string, { group: EntryGroup; members: RecordWithFoundPrinting<ListEntryRecord>[] }>();
  for (const group of groups) {
    const members = findMemberEntries(group, entriesByKey);
    const matchKey = getGroupMatchKey(members);
    if (matchKey !== null && !groupsByMatchKey.has(matchKey)) {
      groupsByMatchKey.set(matchKey, { group, members });
    }
  }

  const clusters = new Map<string, [RecordWithFoundPrinting<ListEntryRecord>, ...RecordWithFoundPrinting<ListEntryRecord>[]]>();
  let unmatchableEntryCount = 0;
  for (const entry of entries) {
    const { groupId } = entry.record;
    // Don't pull printings out of existing groups
    if (groupId !== null && liveGroupIds.has(groupId)) {
      continue;
    }
    const matchKey = getRarityMatchKey(entry);
    if (matchKey === null) {
      unmatchableEntryCount += 1;
      continue;
    }
    const cluster = clusters.get(matchKey);
    if (cluster === undefined) {
      clusters.set(matchKey, [entry]);
    } else {
      cluster.push(entry);
    }
  }

  const changes: RarityGroupChange[] = [];
  for (const [matchKey, cluster] of clusters) {
    const existing = groupsByMatchKey.get(matchKey);
    if (existing !== undefined) {
      changes.push({ groupId: existing.group.groupId, existingMembers: existing.members, addedEntries: cluster });
    } else if (cluster.length >= 2) {
      const groupId = pickGroupIdForEntries(cluster.map(({ record }) => record));
      changes.push({ groupId, existingMembers: [], addedEntries: cluster });
    }
  }

  return {
    changes,
    assignments: changes.map(
      (change): GroupAssignment => ({
        entries: change.addedEntries.map(({ record }) => record),
        groupId: change.groupId,
      }),
    ),
    undoAssignments: getUndoAssignments(changes),
    unmatchableEntryCount,
  };
}