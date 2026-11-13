import { useState } from "react";
import type { SubmitEvent } from "react";
import { createList, deleteList, renameList, useLiveLists } from "../data/lists";
import { OWNED_LIST_ID } from "../data/listsDb";
import type { EntryRecord, ListNameProblem, ListRecord, SaveResult } from "../data/listsDb";

const NAME_PROBLEM_TEXT: Record<ListNameProblem, string> = {
  empty: "Give the list a name.",
  duplicate: "A list with that name already exists.",
};

function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

interface ListNameFormProps {
  initialName: string;
  label: string;
  submitText: string;
  disabled: boolean;
  save: (name: string) => Promise<SaveResult>;
  onSaved?: () => void;
  onCancel?: () => void;
}

// Shared by both renaming and creation functionality
function ListNameForm({ initialName, label, submitText, disabled, save, onSaved, onCancel }: ListNameFormProps) {
  const [name, setName] = useState(initialName);
  const [nameProblem, setNameProblem] = useState<ListNameProblem | null>(null);
  const [saving, setSaving] = useState(false);

  const nameIsBlank = name.trim() === "";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await save(name);
    setSaving(false);

    // nameProblem is null if status isn't "invalid-name", so null just clears the fields that check for one.
    setNameProblem(result.nameProblem);
    if (result.status === "saved") {
      // Back to how the form started: for a new list that empties the field, ready for the next one. (A form that is
      // closed by onSaved goes away anyway, it's okay that it's wrong.)
      setName(initialName);
      onSaved?.();
    }
    // "failed" is shown in the banner instead, so needs no handling here.
  }

  return (
    <>
      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          className="text-input"
          type="text"
          value={name}
          placeholder={label}
          aria-label={label}
          aria-invalid={nameProblem !== null}
          onChange={(event) => {
            setName(event.target.value);
            setNameProblem(null);
          }}
        />
        <button className="action-button" type="submit" disabled={disabled || saving || nameIsBlank}>
          {submitText}
        </button>
        {onCancel !== undefined ? (
          <button className="action-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </form>
      {nameProblem !== null ? (
        <p className="form-error" role="alert">
          {NAME_PROBLEM_TEXT[nameProblem]}
        </p>
      ) : null}
    </>
  );
}

function ListSummaryRow({
  list,
  entries,
  changesDisabled,
}: {
  list: ListRecord;
  entries: readonly EntryRecord[];
  changesDisabled: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const unDedupedCount = entries.reduce((total, entry) => total + entry.quantity, 0);

  async function handleDelete() {
    const confirmed = window.confirm(`Delete the list "${list.name}"? Will not affect card status on any other list.`);
    if (!confirmed) {
      return;
    }
    setDeleting(true);
    await deleteList(list.id);
    // On success this row is gone; on failure it stays, and the banner explains.
    setDeleting(false);
  }

  if (renaming) {
    return (
      <div className="row">
        <ListNameForm
          initialName={list.name}
          label="List name"
          submitText="Save"
          disabled={changesDisabled}
          save={(name) => renameList(list.id, name)}
          onSaved={() => setRenaming(false)}
          onCancel={() => setRenaming(false)}
        />
      </div>
    );
  }

  return (
    <div className="row">
      <div className="row-title">{list.name}</div>
      <div className="row-meta">
        <span>{formatCount(entries.length, "card", "cards")}</span>
        {list.id === OWNED_LIST_ID ? <span>{"(" + unDedupedCount + " including duplicates)"}</span> : null}
        {list.builtIn ? <span className="tag">Built-in</span> : null}
      </div>
      {list.builtIn ? null : (
        <div className="row-actions">
          <button className="action-button" type="button" disabled={changesDisabled} onClick={() => setRenaming(true)}>
            Rename
          </button>
          <button
            className="action-button"
            type="button"
            disabled={changesDisabled || deleting}
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function NewListForm({ disabled }: { disabled: boolean }) {
  return (
    <ListNameForm
      initialName=""
      label="New list name"
      submitText="Create list"
      disabled={disabled}
      save={createList}
    />
  );
}

export function ListsPage() {
  const listsState = useLiveLists();
  const changesDisabled = listsState.status !== "ready";

  return (
    <>
      <h1>Lists</h1>
      <NewListForm disabled={changesDisabled} />
      {listsState.status === "loading" ? (
        <p className="muted">Loading lists…</p>
      ) : listsState.activeLists.length === 0 ? (
        // Only possible after a failed load (the built-in lists always exist otherwise); the banner says why.
        <p className="muted">No lists to show.</p>
      ) : (
        <ul className="row-list">
          {listsState.activeLists.map((list) => (
            <li key={list.id}>
              <ListSummaryRow
                list={list}
                entries={listsState.byList.get(list.id) ?? []}
                changesDisabled={changesDisabled}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}