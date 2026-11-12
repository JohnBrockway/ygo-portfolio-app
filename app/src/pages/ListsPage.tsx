import { useState } from "react";
import type { SubmitEvent } from "react";
import { createList, useLiveLists } from "../data/lists";
import { OWNED_LIST_ID } from "../data/listsDb";
import type { EntryRecord, ListNameProblem, ListRecord } from "../data/listsDb";

const NAME_PROBLEM_TEXT: Record<ListNameProblem, string> = {
  empty: "Give the list a name.",
  duplicate: "A list with that name already exists.",
};

function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// One list's summary: its name, and how many entries are on it. On Owned an entry can hold several copies,
// so the copies are counted too (every other list holds one copy per entry, so they would only repeat the count).
function ListSummaryRow({ list, entries }: { list: ListRecord; entries: readonly EntryRecord[] }) {
  const copyCount = entries.reduce((total, entry) => total + entry.quantity, 0);

  return (
    <div className="row">
      <div className="row-title">{list.name}</div>
      <div className="row-meta">
        <span>{formatCount(entries.length, "card", "cards")}</span>
        {list.id === OWNED_LIST_ID ? <span>{"(" + copyCount + " including duplicates)"}</span> : null}
        {list.builtIn ? <span className="tag">Built-in</span> : null}
      </div>
    </div>
  );
}

function NewListForm({ disabled }: { disabled: boolean }) {
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<ListNameProblem | null>(null);
  const [saving, setSaving] = useState(false);

  const nameIsBlank = name.trim() === "";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await createList(name);
    setSaving(false);

    if (result.status === "saved") {
      setName("");
      setProblem(null);
    } else if (result.status === "invalid-name") {
      setProblem(result.reason);
    } else if (result.status === "failed") {
      // shown in the banner instead, don't need additional handling
    }
  }

  return (
    <>
      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          className="text-input"
          type="text"
          value={name}
          placeholder="New list name"
          aria-label="New list name"
          aria-invalid={problem !== null}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
        />
        <button className="action-button" type="submit" disabled={disabled || saving || nameIsBlank}>
          Create list
        </button>
      </form>
      {problem !== null ? (
        <p className="form-error" role="alert">
          {NAME_PROBLEM_TEXT[problem]}
        </p>
      ) : null}
    </>
  );
}

export function ListsPage() {
  const listsState = useLiveLists();

  return (
    <>
      <h1>Lists</h1>
      <NewListForm disabled={listsState.status !== "ready"} />
      {listsState.status === "loading" ? (
        <p className="muted">Loading lists…</p>
      ) : listsState.lists.length === 0 ? (
        // Only possible after a failed load (the built-in lists always exist otherwise); the banner says why.
        <p className="muted">No lists to show.</p>
      ) : (
        <ul className="row-list">
          {listsState.lists.map((list) => (
            <li key={list.id}>
              <ListSummaryRow list={list} entries={listsState.byList.get(list.id) ?? []} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}