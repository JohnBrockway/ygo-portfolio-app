import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { editionLabel } from "../data/editions";
import type { RecordWithFoundPrinting } from "../data/foundPrintings";
import { getRecordName } from "../data/foundPrintings";
import { formatCount } from "../data/formatCount";
import { setEntriesGroups } from "../data/lists";
import type { ListEntryRecord } from "../data/listsDb";
import type { RarityCollapse, RarityGroupChange } from "../data/rarityCollapse";

// The rarity a member of a group is shown by, or its printing id where the master data doesn't have it.
function getRarityText({ record, found }: RecordWithFoundPrinting<ListEntryRecord>): string {
  return found === null ? record.printingId : found.printing.rarity;
}

// One line of the report for a group: its card, then set number (where it is shown), edition and rarities, and how many
// entries joined it where it was a group already. Members of a group made by collapsing rarities share their card, set
// number and edition, so the first one that joins says it for all of them.
function describeGroupChange(change: RarityGroupChange): { name: string; details: string } {
  const [first] = change.addedEntries;
  const members = [...change.existingMembers, ...change.addedEntries];
  const details: string[] = [];
  if (first.found !== null && !first.found.setcode.set_number_synthetic) {
    details.push(first.found.setcode.set_number);
  }
  details.push(editionLabel(first.record.edition));
  details.push(members.map(getRarityText).join(", "));
  if (change.existingMembers.length > 0) {
    details.push(`${formatCount(change.addedEntries.length, "entry", "entries")} added to an existing group`);
  }
  return { name: getRecordName(first), details: details.join(" · ") };
}

// What was done, in one sentence: how many entries were grouped, in how many new groups and in how many existing ones.
function describeCollapse({ changes }: RarityCollapse): string {
  const newGroupCount = changes.filter((change) => change.existingMembers.length === 0).length;
  const extendedGroupCount = changes.length - newGroupCount;
  const entryCount = changes.reduce((total, change) => total + change.addedEntries.length, 0);

  const parts: string[] = [];
  if (newGroupCount > 0) {
    parts.push(`${formatCount(newGroupCount, "group", "groups")} made`);
  }
  if (extendedGroupCount > 0) {
    parts.push(`${formatCount(extendedGroupCount, "group", "groups")} added to`);
  }
  return `${formatCount(entryCount, "entry", "entries")} grouped: ${parts.join(", ")}.`;
}

// A modal that reports what collapsing rarities did (opened by CollapseRaritiesButton, which has already saved it), or
// that there was nothing to collapse. Everything that closes it goes through dialog.close(), so the browser handles
// Escape and returns focus to the button; onClosed then tells the button to unmount the dialog.
// The three ways out of a result: "Keep" accepts it, "Review groups" closes the dialog and hands the groups' ids to
// onReview (for the page to open them), and "Undo" saves the opposite change (collapse.undoAssignments), which puts every
// entry back in the group it was in before, and closes the dialog once that is saved. After a failed undo the dialog
// stays open and the banner explains.
export function CollapseRaritiesDialog({
  listId,
  collapse,
  changesDisabled,
  onReview,
  onClosed,
}: {
  listId: string;
  collapse: RarityCollapse;
  changesDisabled: boolean;
  onReview: (groupIds: readonly string[]) => void;
  onClosed: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [undoing, setUndoing] = useState(false);

  // Opened here, not with the `open` attribute, because only showModal makes it modal. The check is for React's
  // StrictMode, which runs effects twice in development.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  function closeDialog(): void {
    dialogRef.current?.close();
  }

  function handleReview() {
    onReview(collapse.changes.map((change) => change.groupId));
    closeDialog();
  }

  async function handleUndo() {
    setUndoing(true);
    const result = await setEntriesGroups(listId, collapse.undoAssignments);
    setUndoing(false);
    if (result.status === "saved") {
      closeDialog();
    }
  }

  let skippedHint: ReactNode = null;
  if (collapse.unmatchableEntryCount > 0) {
    skippedHint = (
      <p className="muted dialog-hint">
        {formatCount(collapse.unmatchableEntryCount, "entry", "entries")} left out because the artwork isn't known.
      </p>
    );
  }

  let content: ReactNode;
  if (collapse.changes.length === 0) {
    content = (
      <>
        <h2 id={titleId} className="dialog-title">
          Nothing to collapse
        </h2>
        <p className="dialog-hint">No entries on this list differ only by rarity, or the ones that do are grouped already.</p>
        {skippedHint}
        <button type="button" className="action-button" onClick={closeDialog}>
          Close
        </button>
      </>
    );
  } else {
    content = (
      <>
        <h2 id={titleId} className="dialog-title">
          Rarities collapsed
        </h2>
        <p className="dialog-hint">{describeCollapse(collapse)}</p>
        <ul className="list-choices collapse-report">
          {collapse.changes.map((change) => {
            const { name, details } = describeGroupChange(change);
            return (
              <li key={change.groupId}>
                <div>{name}</div>
                <div className="muted dialog-hint">{details}</div>
              </li>
            );
          })}
        </ul>
        {skippedHint}
        <button type="button" className="action-button" onClick={closeDialog}>
          Keep
        </button>
        <button type="button" className="action-button" onClick={handleReview}>
          Review groups
        </button>
        <button
          type="button"
          className="action-button"
          disabled={changesDisabled || undoing}
          title="Put every entry back in the group it was in before"
          onClick={handleUndo}
        >
          Undo
        </button>
      </>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClosed}
      // A click on the backdrop lands on the dialog element itself; a click inside lands on something within it.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      <div className="dialog-body">{content}</div>
    </dialog>
  );
}