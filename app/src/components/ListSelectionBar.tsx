import { useState } from "react";
import { pickGroupIdForEntries } from "../data/entryGroups";
import type { EntryGroup } from "../data/entryGroups";
import { formatCount } from "../data/formatCount";
import { setEntriesGroups } from "../data/lists";
import type { GroupAssignment, ListEntryRecord } from "../data/listsDb";

export interface ListSelection {
  // Selected entries that are not in a live group.
  plainEntries: ListEntryRecord[];
  // Selected entries that are in a live group (picked inside its container).
  memberEntries: ListEntryRecord[];
  // Selected live groups, as a whole.
  groups: EntryGroup[];
}

// The one change the selection allows, with the button's label. assignments is what to save, and is null while the
// selection allows no change; hint then says what to select, and is null otherwise.
interface GroupAction {
  label: string;
  assignments: GroupAssignment[] | null;
  hint: string | null;
}

function getGroupAction({ plainEntries, memberEntries, groups }: ListSelection): GroupAction {
  const [onlyGroup] = groups;

  // Entries and a group: the entries join it. A group alone: it is dissolved.
  if (onlyGroup !== undefined && groups.length === 1 && memberEntries.length === 0) {
    if (plainEntries.length === 0) {
      return { label: "Ungroup", assignments: [{ entries: [...onlyGroup.members], groupId: null }], hint: null };
    }
    return {
      label: "Add to group",
      assignments: [{ entries: plainEntries, groupId: onlyGroup.groupId }],
      hint: null,
    };
  }
  // Two or more entries that are in no group: they become one.
  if (groups.length === 0 && memberEntries.length === 0 && plainEntries.length >= 2) {
    return {
      label: "Group",
      assignments: [{ entries: plainEntries, groupId: pickGroupIdForEntries(plainEntries) }],
      hint: null,
    };
  }
  // Members of a group on their own: they leave it.
  if (groups.length === 0 && plainEntries.length === 0 && memberEntries.length >= 1) {
    return {
      label: "Remove from group",
      assignments: [{ entries: memberEntries, groupId: null }],
      hint: null,
    };
  }

  let hint: string;
  if (groups.length > 1) {
    hint = "Select one group at a time.";
  } else if (memberEntries.length > 0) {
    hint = "Entries inside a group can only be taken out of it one by one.";
  } else if (plainEntries.length === 0 && groups.length === 0) {
    hint = "Select entries to group them, or a group to change it.";
  } else {
    hint = "Select another entry to group it with, or a group to add it to.";
  }
  return { label: "Group", assignments: null, hint };
}

function describeSelection({ plainEntries, memberEntries, groups }: ListSelection): string {
  const parts: string[] = [];
  const entryCount = plainEntries.length + memberEntries.length;
  if (entryCount > 0) {
    parts.push(formatCount(entryCount, "entry", "entries"));
  }
  if (groups.length > 0) {
    parts.push(formatCount(groups.length, "group", "groups"));
  }
  return parts.length === 0 ? "Nothing selected" : `${parts.join(" and ")} selected`;
}

// The bar that says what is selected on a list page and offers the change that selection allows (group, add to group,
// ungroup, or remove from group), and the button that leaves select mode. It is only there in select mode, and sticks to
// the top of the screen so it stays in reach in a long list. onSaved is called after a change has been saved, for the
// caller to let go of what was selected.
export function ListSelectionBar({
  listId,
  selection,
  changesDisabled,
  onSaved,
  onExitSelectMode,
}: {
  listId: string;
  selection: ListSelection;
  changesDisabled: boolean;
  onSaved: () => void;
  onExitSelectMode: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const action = getGroupAction(selection);
  const { assignments } = action;

  async function handleAction() {
    if (assignments === null) {
      return;
    }
    setSaving(true);
    const result = await setEntriesGroups(listId, assignments);
    setSaving(false);
    // Only a change that was saved lets go of the selection; after a failure it stays, and the banner explains.
    if (result.status === "saved") {
      onSaved();
    }
  }

  return (
    <div className="list-selection-bar">
      <div className="list-selection-info">
        <div className="list-selection-name">{describeSelection(selection)}</div>
        {action.hint === null ? null : <div className="muted">{action.hint}</div>}
      </div>
      <div className="list-selection-actions">
        <button
          className="action-button"
          type="button"
          disabled={assignments === null || changesDisabled || saving}
          onClick={handleAction}
        >
          {action.label}
        </button>
        <button className="action-button" type="button" onClick={onExitSelectMode}>
          Done
        </button>
      </div>
    </div>
  );
}