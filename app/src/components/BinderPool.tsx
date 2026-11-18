import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getBinderCardName } from "../data/binderPlacements";
import type { BinderCardWithPrinting } from "../data/binderPlacements";
import type { BinderRecord } from "../data/bindersDb";
import { matchesAllTokens, splitQuery } from "../data/search";
import { AddListButtons } from "./AddListButtons";
import { BinderPoolCard } from "./BinderPoolCard";
import { BinderSelectionBar } from "./BinderSelectionBar";
import { SearchBar } from "./SearchBar";

// The card pool of a binder, as the user sees it: the cards that are not in a slot, as compact cards, under a toolbar. The
// toolbar is one row (it wraps on a narrow screen) and stays in view while the pool scrolls. It has the control that adds
// cards from a list, and beside it either the name filter (while nothing is picked up) or the bar that says which card is
// picked up (also one that is picked up from a slot). (Every card of the binder is in the pool as far as the data goes,
// placed or not; a placed card is shown in its slot instead.) Tapping a card picks it up.
//
// The name filter only changes which cards the pool shows. Its text is plain state of this component (not in the address
// bar), so it stays when the name filter is replaced by the selection bar, and starts empty again when the binder is
// opened anew.
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
  const [nameQuery, setNameQuery] = useState("");
  const nameTokens = useMemo(() => splitQuery(nameQuery), [nameQuery]);

  const unplacedCardTiles = cardTiles.filter((tile) => tile.record.placement === null);
  const shownCardTiles = unplacedCardTiles.filter((tile) => matchesAllTokens(getBinderCardName(tile), nameTokens));

  let contents: ReactNode;
  if (cardTiles.length === 0) {
    contents = <p className="muted">No cards in this binder yet.</p>;
  } else if (unplacedCardTiles.length === 0) {
    contents = <p className="muted">Every card in this binder is in a slot.</p>;
  } else if (shownCardTiles.length === 0) {
    contents = <p className="muted">No cards in the pool match this search.</p>;
  } else {
    contents = (
      <ul className="tile-grid">
        {shownCardTiles.map((tile) => (
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

  let toolbarMain: ReactNode;
  if (selectedCard === null) {
    toolbarMain = <SearchBar value={nameQuery} onChange={setNameQuery} label="Filter cards by name" />;
  } else {
    toolbarMain = (
      <BinderSelectionBar
        binder={binder}
        selectedCard={selectedCard}
        changesDisabled={changesDisabled}
        onClearSelection={onClearSelection}
      />
    );
  }

  return (
    <section className="binder-pool">
      <div className="binder-pool-toolbar">
        <AddListButtons binderId={binder.id} changesDisabled={changesDisabled} />
        <div className="binder-pool-toolbar-main">{toolbarMain}</div>
      </div>
      {contents}
    </section>
  );
}