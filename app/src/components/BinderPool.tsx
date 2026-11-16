import { useMemo } from "react";
import type { ReactNode } from "react";
import type { BinderCardRecord } from "../data/bindersDb";
import { formatCount } from "../data/formatCount";
import { joinRecordsWithMasterData } from "../data/foundPrintings";
import type { FoundPrinting } from "../data/foundPrintings";
import { AddListButtons } from "./AddListButtons";
import { BinderCardTile } from "./BinderCardTile";

// The card pool of a binder: every card in it (placed or not), as tiles, with the buttons that add cards.
export function BinderPool({
  binderId,
  cards,
  foundPrintingsById,
  changesDisabled,
}: {
  binderId: string;
  cards: readonly BinderCardRecord[];
  foundPrintingsById: ReadonlyMap<string, FoundPrinting>;
  changesDisabled: boolean;
}) {
  const tiles = useMemo(() => joinRecordsWithMasterData(cards, foundPrintingsById), [cards, foundPrintingsById]);

  let contents: ReactNode;
  if (tiles.length === 0) {
    contents = <p className="muted">No cards in this binder yet.</p>;
  } else {
    contents = (
      <ul className="tile-grid tile-grid-cards">
        {tiles.map((tile) => (
          <li key={tile.record.id}>
            <BinderCardTile binderCard={tile} changesDisabled={changesDisabled} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="binder-pool">
      <h2 className="binder-pool-title">Card pool</h2>
      <div className="row-meta">
        <span>{formatCount(cards.length, "card", "cards")}</span>
      </div>
      <AddListButtons binderId={binderId} changesDisabled={changesDisabled} />
      {contents}
    </section>
  );
}