import { useState } from "react";
import type { ReactNode, SubmitEvent } from "react";
import { LinkWithReturnInfo } from "../components/LinkWithReturnInfo";
import { ListMeta } from "../components/ListMeta";
import { createList, deleteList, getListEntries, renameList, useLiveLists } from "../data/lists";
import type { EntryRecord, ListNameProblem, ListRecord, SaveResult } from "../data/listsDb";

const BACK_LABEL = "lists";

const NAME_PROBLEM_TEXT: Record<ListNameProblem, string> = {
  empty: "Give the list a name.",
  duplicate: "A list with that name already exists.",
};

// The shared look of the small line icons on the row buttons. Decorative: the buttons carry the accessible name.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function PencilIcon() {
  return (
    <Icon>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </Icon>
  );
}

function TrashIcon() {
  return (
    <Icon>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Icon>
  );
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
      <ListMeta list={list} entries={entries} />
      <div className="row-actions">
        <LinkWithReturnInfo
          to={`/lists/${list.id}`}
          backLabel={BACK_LABEL}
          className="action-button open-button"
          title={`Open ${list.name}`}
        >
          Open
        </LinkWithReturnInfo>
        {list.builtIn ? null : (
          <>
            <button
              className="action-button icon-button"
              type="button"
              aria-label={`Rename the list "${list.name}"`}
              title="Rename"
              disabled={changesDisabled}
              onClick={() => setRenaming(true)}
            >
              <PencilIcon />
            </button>
            <button
              className="action-button icon-button"
              type="button"
              aria-label={`Delete the list "${list.name}"`}
              title="Delete"
              disabled={changesDisabled || deleting}
              onClick={handleDelete}
            >
              <TrashIcon />
            </button>
          </>
        )}
      </div>
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
                entries={getListEntries(listsState, list.id)}
                changesDisabled={changesDisabled}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}