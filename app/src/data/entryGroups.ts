import type { ListEntryRecord } from "./listsDb";
import { makeRecordId } from "./recordConventions";

// What a group is. Groups are not stored anywhere: the only thing on disk is the groupId of each entry (see
// ListEntryRecord.groupId), and this file works out the groups from those.

// A live group: two or more active entries of one list that share a groupId.
export interface EntryGroup {
  groupId: string;
  listId: string;
  members: readonly ListEntryRecord[];
}

// The live groups among these entries, which have to be active ones (removed entries left out), in the order of their
// first member. An entry whose groupId nobody else on its list shares is not in any group: it is a survivor and shows
// as a plain entry. Merges between devices can leave a group down to one member, and this is what heals that.
export function findLiveGroups(activeEntries: readonly ListEntryRecord[]): EntryGroup[] {
  const groupsByKey = new Map<string, { groupId: string; listId: string; members: ListEntryRecord[] }>();
  for (const entry of activeEntries) {
    if (entry.groupId !== null) {
      const key = JSON.stringify([entry.listId, entry.groupId]);
      const group = groupsByKey.get(key);
      if (group === undefined) {
        groupsByKey.set(key, { groupId: entry.groupId, listId: entry.listId, members: [entry] });
      } else {
        group.members.push(entry);
      }
    }
  }
  return [...groupsByKey.values()].filter((group) => group.members.length >= 2);
}

// The groupId for a group made out of these entries, none of which is in a live group. If exactly one of them still
// carries the groupId of a group that has shrunk to it (a survivor), the new group takes that id over, so that whatever
// was following that group (a binder's group card) goes on following it. Otherwise the group gets a new id.
export function pickGroupIdForEntries(entries: readonly ListEntryRecord[]): string {
  const survivorGroupIds = entries.flatMap((entry) => (entry.groupId === null ? [] : [entry.groupId]));
  const [survivorGroupId] = survivorGroupIds;
  return survivorGroupIds.length === 1 && survivorGroupId !== undefined ? survivorGroupId : makeRecordId();
}