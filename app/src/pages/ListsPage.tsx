import { useLiveLists } from "../data/lists";
import { OWNED_LIST_ID } from "../data/listsDb";
import type { EntryRecord, ListRecord } from "../data/listsDb";

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

export function ListsPage() {
  const listsState = useLiveLists();

  return (
    <>
      <h1>Lists</h1>
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