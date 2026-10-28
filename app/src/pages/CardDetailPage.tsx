import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { loadMasterData } from "../data/masterData";
import type { MasterData } from "../data/types";

type SetRecord = MasterData["sets"][number];
type PrintingRecord = MasterData["printings"][number];

// A printing plus the set info we need to display and sort it.
type PrintingRowData = {
  printing: PrintingRecord;
  set: SetRecord | undefined;
  releaseDate: string | null;
  region: string;
  setTitle: string;
};

// Sets with a missing release date sort last instead of breaking the sort.
function compareReleaseDates(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return a.localeCompare(b);
}

function comparePrintingRows(a: PrintingRowData, b: PrintingRowData): number {
  const byDate = compareReleaseDates(a.releaseDate, b.releaseDate);
  if (byDate !== 0) {
    return byDate;
  }
  const byRegion = a.region.localeCompare(b.region);
  if (byRegion !== 0) {
    return byRegion;
  }
  const byTitle = a.setTitle.localeCompare(b.setTitle);
  if (byTitle !== 0) {
    return byTitle;
  }
  // numeric: true sorts "LOB-EN013" before "LOB-EN072".
  return a.printing.set_number.localeCompare(b.printing.set_number, undefined, { numeric: true });
}

function CardPrintings({ data, cardId }: { data: MasterData; cardId: string | undefined }) {
  const card = data.cards.find((candidate) => candidate.card_id === cardId);
  if (card === undefined) {
    return (
      <>
        <h1>Card not found</h1>
        <p className="muted">No card matches this address.</p>
      </>
    );
  }

  const setsById = new Map<string, SetRecord>();
  for (const set of data.sets) {
    setsById.set(set.set_id, set);
  }

  const rows: PrintingRowData[] = [];
  for (const printing of data.printings) {
    if (printing.card_id !== card.card_id) {
      continue;
    }
    const set = setsById.get(printing.set_id);
    let releaseDate: string | null = null;
    if (set !== undefined && set.release_date) {
      releaseDate = set.release_date.iso;
    }
    rows.push({
      printing,
      set,
      releaseDate,
      region: set === undefined ? "" : set.region,
      setTitle: set === undefined ? printing.set_id : set.title,
    });
  }
  rows.sort(comparePrintingRows);

  let list: ReactNode;
  if (rows.length === 0) {
    list = <p className="muted">No printings for this card.</p>;
  } else {
    list = (
      <ul className="row-list">
        {rows.map((row) => (
          <li key={row.printing.printing_id} className="row">
            <div className="row-title">
              {row.set === undefined ? (
                row.setTitle
              ) : (
                <Link to={`/sets/${row.set.set_id}`}>{row.setTitle}</Link>
              )}
            </div>
            <div className="row-meta">
              {row.region === "" ? null : <span className="tag">{row.region}</span>}
              {row.printing.set_number_synthetic ? null : <span>{row.printing.set_number}</span>}
              <span className="tag">{row.printing.rarity}</span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <h1>{card.title}</h1>
      {list}
    </>
  );
}

export function CardDetailPage() {
  const { cardId } = useParams();
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
    content = <CardPrintings data={data} cardId={cardId} />;
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