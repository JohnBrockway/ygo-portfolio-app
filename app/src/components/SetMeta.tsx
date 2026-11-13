import { formatCount } from "../data/formatCount";
import type { CardSet } from "../data/types";

export function SetMeta({ set }: { set: CardSet }) {
  const dateText = set.release_date ? set.release_date.text : "Date unknown";

  return (
    <div className="row-meta">
      <span className="tag">{set.region.toUpperCase()}</span>
      <span>{dateText}</span>
      <span>{formatCount(set.setcode_count, "printing", "printings")}</span>
    </div>
  );
}