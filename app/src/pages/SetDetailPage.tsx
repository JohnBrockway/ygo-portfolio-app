import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { SetCodeTile } from "../components/SetCodeTile";
import { SetMeta } from "../components/SetMeta";
import { setNumberCollator } from "../data/collators";
import { indexBy } from "../data/indexBy";
import { loadMasterData } from "../data/masterData";
import type { Card, MasterData, SetCode } from "../data/types";
import { useLoadOnMount } from "../data/useLoadOnMount";

// A setcode of this set with the card it belongs to (needed to show its tile).
type SetCodeWithCard = {
  setcode: SetCode;
  card: Card;
};

function SetPrintings({ data, setId }: { data: MasterData; setId: string | undefined }) {
  const set = data.sets.find((candidate) => candidate.set_id === setId);
  if (set === undefined) {
    return (
      <>
        <h1>Set not found</h1>
        <p className="muted">No set matches this address.</p>
      </>
    );
  }

  const cardsById = indexBy(data.cards, (card) => card.card_id);

  // Synthetic set numbers are never shown, but still keep the tiles in a sensible order.
  // A tile can't be shown without its card, so a setcode without one is dropped here.
  const setcodes = data.setcodes
    .filter((setcode) => setcode.set_id === set.set_id)
    .sort((a, b) => setNumberCollator.compare(a.set_number, b.set_number))
    .flatMap((setcode): SetCodeWithCard[] => {
      const card = cardsById.get(setcode.card_id);
      return card === undefined ? [] : [{ setcode, card }];
    });

  let list: ReactNode;
  if (setcodes.length === 0) {
    list = <p className="muted">No printings in this set.</p>;
  } else {
    list = (
      <ul className="tile-grid tile-grid-cards">
        {setcodes.map(({ setcode, card }) => (
          <li key={setcode.setcode_id}>
            <SetCodeTile card={card} setcode={setcode} backLabel={set.title} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <h1>{set.title}</h1>
      <SetMeta set={set} />
      {list}
    </>
  );
}

export function SetDetailPage() {
  const { setId } = useParams();
  const { data, error } = useLoadOnMount(loadMasterData);

  let content: ReactNode;
  if (error !== null) {
    content = <p>Couldn't load printings: {error}</p>;
  } else if (data === null) {
    content = <p className="muted">Loading printings…</p>;
  } else {
    content = <SetPrintings data={data} setId={setId} />;
  }

  return (
    <>
      <p>
        <BackLink fallbackTo="/sets" fallbackLabel="Sets" />
      </p>
      {content}
    </>
  );
}