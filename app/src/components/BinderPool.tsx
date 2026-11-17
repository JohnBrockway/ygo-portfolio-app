import type { ReactNode } from "react";
import type { BinderCardWithPrinting } from "../data/binderPlacements";
import type { BinderRecord } from "../data/bindersDb";
import { formatCount } from "../data/formatCount";
import { AddListButtons } from "./AddListButtons";
import { BinderPoolCard } from "./BinderPoolCard";
import { BinderSelectionBar } from "./BinderSelectionBar";

// The card pool of a binder, as the user sees it: the cards that are not in a slot, as compact cards, with the buttons
// that add cards. (Every card of the binder is in the pool as far as the data goes, placed or not; a placed card is shown
// in its slot instead.) Tapping a card picks it up; the bar above the cards says which card is picked up (also one that
// is picked up from a slot) and stays in view while the pool scrolls.
export function BinderPool({
  binder,
  cardTiles,
  selectedCard,
  changesDisabled,
  onToggleCardSelection,
  onClearSelection,
}: {
  binder: BinderRecord;
  // Every card of the binder, placed or not.
  cardTiles: readonly BinderCardWithPrinting[];
  // The card that is picked up (in the pool or in a slot), or null.
  selectedCard: BinderCardWithPrinting | null;
  changesDisabled: boolean;
  onToggleCardSelection: (cardId: string) => void;
  onClearSelection: () => void;
}) {
  const unplacedCardTiles = cardTiles.filter((tile) => tile.record.placement === null);

  let contents: ReactNode;
  if (cardTiles.length === 0) {
    contents = <p className="muted">No cards in this binder yet.</p>;
  } else if (unplacedCardTiles.length === 0) {
    contents = <p className="muted">Every card in this binder is in a slot.</p>;
  } else {
    contents = (
      <ul className="tile-grid">
        {unplacedCardTiles.map((tile) => (
          <li key={tile.record.id}>
            <BinderPoolCard
              binderCard={tile}
              isSelected={selectedCard !== null && selectedCard.record.id === tile.record.id}
              changesDisabled={changesDisabled}
              onToggleSelection={() => onToggleCardSelection(tile.record.id)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="binder-pool">
      <div className="row-meta">
        <span>{formatCount(unplacedCardTiles.length, "card", "cards")} unplaced</span>
        <span>{formatCount(cardTiles.length, "card", "cards")} in binder</span>
      </div>
      <AddListButtons binderId={binder.id} changesDisabled={changesDisabled} />
      <BinderSelectionBar
        binder={binder}
        selectedCard={selectedCard}
        changesDisabled={changesDisabled}
        onClearSelection={onClearSelection}
      />
      {contents}
    </section>
  );
}