import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { SetMeta } from "../components/SetMeta";
import { loadMasterData } from "../data/masterData";
import type { Card, MasterData } from "../data/types";

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

  // Synthetic set numbers are never shown, but still keep the rows in a sensible order.
  // numeric: true sorts "LOB-EN013" before "LOB-EN072" and "LB-9" before "LB-10".
  const printings = data.printings
    .filter((printing) => printing.set_id === set.set_id)
    .sort((a, b) => a.set_number.localeCompare(b.set_number, undefined, { numeric: true }));

  let list: ReactNode;
  if (printings.length === 0) {
    list = <p className="muted">No printings in this set.</p>;
  } else {
    list = (
      <ul className="row-list">
        {printings.map((printing) => {
          const card = cardsById.get(printing.card_id);
          const cardName = card === undefined ? printing.card_id : card.title;
          return (
            <li key={printing.printing_id} className="row">
              <div className="row-title">{cardName}</div>
              <div className="row-meta">
                {printing.set_number_synthetic ? null : <span>{printing.set_number}</span>}
                <span className="tag">{printing.rarity}</span>
              </div>
            </li>
          );
        })}
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
        <Link to="/sets">Back to Sets</Link>
      </p>
      {content}
    </>
  );
}