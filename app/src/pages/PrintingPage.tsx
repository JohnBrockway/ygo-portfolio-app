import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { editionLabel } from "../data/editions";
import { loadMasterData } from "../data/masterData";
import type { Edition, MasterData } from "../data/types";

// One row per edition this printing exists in. TODO this is where the owned counter goes.
function EditionRows({ editions }: { editions: Edition[] }) {
  if (editions.length === 0) {
    return (
      <ul className="row-list">
        <li className="row">
          <div className="row-title">No edition</div>
        </li>
      </ul>
    );
  }

  return (
    <ul className="row-list">
      {editions.map((edition) => (
        <li key={edition} className="row">
          <div className="row-title">{editionLabel(edition)}</div>
        </li>
      ))}
    </ul>
  );
}

function PrintingDetail({ data, printingId }: { data: MasterData; printingId: string | undefined }) {
  const printing = data.printings.find((candidate) => candidate.printing_id === printingId);
  if (printing === undefined) {
    return (
      <>
        <h1>Printing not found</h1>
        <p className="muted">No printing matching this code.</p>
      </>
    );
  }

  // Either record can be missing in the data; fall back to ids instead of breaking the page.
  const card = data.cards.find((candidate) => candidate.card_id === printing.card_id);
  const set = data.sets.find((candidate) => candidate.set_id === printing.set_id);
  const cardTitle = card === undefined ? printing.card_id : card.title;
  const setTitle = set === undefined ? printing.set_id : set.title;
  const editions: Edition[] = set === undefined ? [] : set.editions;

  return (
    <>
      <h1>
        {card === undefined ? cardTitle : <Link to={`/cards/${card.card_id}`}>{cardTitle}</Link>}
      </h1>
      <p>{set === undefined ? setTitle : <Link to={`/sets/${set.set_id}`}>{setTitle}</Link>}</p>
      <div className="row-meta">
        {set === undefined ? null : <span className="tag">{set.region}</span>}
        {printing.set_number_synthetic ? null : <span>{printing.set_number}</span>}
        <span className="tag">{printing.rarity}</span>
      </div>
      <h2>Editions</h2>
      <EditionRows editions={editions} />
    </>
  );
}

export function PrintingPage() {
  const { printingId } = useParams();
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
    content = <p>Couldn't load printing: {error}</p>;
  } else if (data === null) {
    content = <p className="muted">Loading printing…</p>;
  } else {
    content = <PrintingDetail data={data} printingId={printingId} />;
  }

  return (
    <>
      <p>
        <Link to="/cards">Back to Cards</Link>
      </p>
      {content}
    </>
  );
}