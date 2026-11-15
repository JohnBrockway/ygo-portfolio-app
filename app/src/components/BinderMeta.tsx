import type { BinderCardRecord, BinderRecord } from "../data/bindersDb";
import { formatCount } from "../data/formatCount";

// What a binder holds, in one line: the grid of its pages, how many pages, and how many cards (placed or not).
export function BinderMeta({ binder, cards }: { binder: BinderRecord; cards: readonly BinderCardRecord[] }) {
  return (
    <div className="row-meta">
      <span>{`${binder.columns} × ${binder.rows} grid`}</span>
      <span>{formatCount(binder.pageIds.length, "page", "pages")}</span>
      <span>{formatCount(cards.length, "card", "cards")}</span>
    </div>
  );
}