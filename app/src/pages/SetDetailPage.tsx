import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { CardTile } from "../components/CardTile";
import { SetMeta } from "../components/SetMeta";
import { loadMasterData } from "../data/masterData";
import type { Card, MasterData } from "../data/types";

type SetCodeRecord = MasterData["setcodes"][number];

// A setcode of this set with the card it belongs to (needed to show its tile).
type SetCodeWithCard = {
  setcode: SetCodeRecord;
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

  const cardsById = new Map<string, Card>();
  for (const card of data.cards) {
    cardsById.set(card.card_id, card);
  }

  // Synthetic set numbers are never shown, but still keep the tiles in a sensible order.
  // numeric: true sorts "LOB-EN013" before "LOB-EN072" and "LB-9" before "LB-10".
  // A tile can't be shown without its card, so a setcode without one is dropped here.
  const setcodes = data.setcodes
    .filter((setcode) => setcode.set_id === set.set_id)
    .sort((a, b) => a.set_number.localeCompare(b.set_number, undefined, { numeric: true }))
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
            <CardTile card={card} setcode={setcode} backLabel={set.title} />
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
  const [data, setData] = useState<MasterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore the result if the page was left before the fetch finished.
    let cancelled = false;

    loadMasterData()
      .then((loadedData) => {
        if (!cancelled) {
          setData(loadedData);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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