import type { CardSet } from "../data/types";

function formatPrintingCount(count: number): string {
  return count === 1 ? "1 printing" : `${count} printings`;
}

export function SetMeta({ set }: { set: CardSet }) {
  const dateText = set.release_date ? set.release_date.text : "Date unknown";

  return (
    <div className="row-meta">
      <span className="tag">{set.region.toUpperCase()}</span>
      <span>{dateText}</span>
      <span>{formatPrintingCount(set.printing_count)}</span>
    </div>
  );
}