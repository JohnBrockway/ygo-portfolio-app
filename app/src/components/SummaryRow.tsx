import { useState } from "react";
import type { ReactNode } from "react";
import type { RecordSaveResult } from "../data/recordConventions";
import { PencilIcon, TrashIcon } from "./ActionIcons";
import { LinkWithReturnInfo } from "./LinkWithReturnInfo";
import { NameForm } from "./NameForm";

type SummaryRowProps = {
  // What the row is, as the user knows it: "list", "binder". Used in labels and in the delete confirmation.
  noun: string;
  name: string;
  // The line of details under the name.
  meta: ReactNode;
  openTo: string;
  backLabel: string;
  // False for a row that can be opened but not renamed or deleted (the built-in lists).
  editable: boolean;
  changesDisabled: boolean;
  // Said after the question when the user is asked to confirm a deletion.
  deleteConsequence: string;
  renameRecord: (name: string) => Promise<RecordSaveResult<unknown>>;
  deleteRecord: () => Promise<unknown>;
};

// One row of the lists page or the binders page: the name, details, and the buttons to open, rename and delete it.
export function SummaryRow({
  noun,
  name,
  meta,
  openTo,
  backLabel,
  editable,
  changesDisabled,
  deleteConsequence,
  renameRecord,
  deleteRecord,
}: SummaryRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(`Delete the ${noun} "${name}"? ${deleteConsequence}`);
    if (!confirmed) {
      return;
    }
    setDeleting(true);
    await deleteRecord();
    // On success this row is gone; on failure it stays, and the banner explains.
    setDeleting(false);
  }

  if (renaming) {
    return (
      <div className="row">
        <NameForm
          noun={noun}
          initialName={name}
          label={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} name`}
          submitText="Save"
          disabled={changesDisabled}
          save={renameRecord}
          onSaved={() => setRenaming(false)}
          onCancel={() => setRenaming(false)}
        />
      </div>
    );
  }

  return (
    <div className="row">
      <div className="row-title">{name}</div>
      {meta}
      <div className="row-actions">
        <LinkWithReturnInfo
          to={openTo}
          backLabel={backLabel}
          className="action-button open-button"
          title={`Open ${name}`}
        >
          Open
        </LinkWithReturnInfo>
        {editable ? (
          <>
            <button
              className="action-button icon-button"
              type="button"
              aria-label={`Rename the ${noun} "${name}"`}
              title="Rename"
              disabled={changesDisabled}
              onClick={() => setRenaming(true)}
            >
              <PencilIcon />
            </button>
            <button
              className="action-button icon-button"
              type="button"
              aria-label={`Delete the ${noun} "${name}"`}
              title="Delete"
              disabled={changesDisabled || deleting}
              onClick={handleDelete}
            >
              <TrashIcon />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}