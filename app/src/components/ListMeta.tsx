import { formatCount } from "../data/formatCount";
import { OWNED_LIST_ID } from "../data/listsDb";
import type { EntryRecord, ListRecord } from "../data/listsDb";

// What a list holds, in one line: how many cards (and, for Owned, copies), and whether it is a built-in list.
export function ListMeta({ list, entries }: { list: ListRecord; entries: readonly EntryRecord[] }) {
  const nonDedupedCount = entries.reduce((total, entry) => total + entry.quantity, 0);

  return (
    <div className="row-meta">
      <span>{formatCount(entries.length, "card", "cards")}</span>
      {list.id === OWNED_LIST_ID ? <span>{`(${nonDedupedCount} including duplicates)`}</span> : null}
      {list.builtIn ? <span className="tag">Built-in</span> : null}
    </div>
  );
}