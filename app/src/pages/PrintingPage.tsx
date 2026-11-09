import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { LinkWithReturnInfo } from "../components/LinkWithReturnInfo";
import { PrintingArt } from "../components/PrintingArt";
import { editionLabel } from "../data/editions";
import { loadMasterData } from "../data/masterData";
import { printingName } from "../data/printings";
import type { Edition, MasterData } from "../data/types";

// One row per edition the set has. TODO this is where the owned counter goes.
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

function PrintingDetail({ data, setcodeId }: { data: MasterData; setcodeId: string | undefined }) {
  const setcode = data.setcodes.find((candidate) => candidate.setcode_id === setcodeId);
  if (setcode === undefined) {
    return (
      <>
        <h1>Printing not found</h1>
        <p className="muted">No printing matching this code.</p>
      </>
    );
  }

  // Either record can be missing in the data; fall back to ids instead of breaking the page.
  const card = data.cards.find((candidate) => candidate.card_id === setcode.card_id);
  const set = data.sets.find((candidate) => candidate.set_id === setcode.set_id);
  const cardTitle = card === undefined ? setcode.card_id : card.title;
  const setTitle = set === undefined ? setcode.set_id : set.title;
  const editions: Edition[] = set === undefined ? [] : set.editions;
  let returnLabel;
  if (setcode.set_number_synthetic) {
    returnLabel = card === undefined ? "printing" : card.title;
  } else {
    returnLabel = setcode.set_number;
  }

  return (
    <>
      <h1>
        {card === undefined ? (
          cardTitle
        ) : (
          <LinkWithReturnInfo to={`/cards/${card.card_id}`} backLabel={returnLabel}>
            {cardTitle}
          </LinkWithReturnInfo>
        )}
      </h1>
      <p>
        {set === undefined ? (
          setTitle
        ) : (
          <LinkWithReturnInfo to={`/sets/${set.set_id}`} backLabel={returnLabel}>
            {setTitle}
          </LinkWithReturnInfo>
        )}
      </p>
      <div className="row-meta">
        {set === undefined ? null : <span className="tag">{set.region}</span>}
        {setcode.set_number_synthetic ? null : <span>{setcode.set_number}</span>}
      </div>
      {setcode.printings.map((printing) => (
        <section key={printing.printing_id}>
          <h2>{printingName(printing, setcode.printings)}</h2>
          {printing.verified ? (
            <div className="row-meta">
              <span className="tag">Verified</span>
            </div>
          ) : null}
          {card === undefined ? null : <PrintingArt card={card} printing={printing} />}
          <EditionRows editions={editions} />
        </section>
      ))}
    </>
  );
}

export function PrintingPage() {
  const { setcodeId } = useParams();
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
    content = <PrintingDetail data={data} setcodeId={setcodeId} />;
  }

  return (
    <>
      <p>
        <BackLink fallbackTo="/cards" fallbackLabel="Cards" />
      </p>
      {content}
    </>
  );
}