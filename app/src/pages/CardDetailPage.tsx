import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { CardTile } from "../components/CardTile";
import { getAvailableImages } from "../data/images";
import type { AvailableImage } from "../data/images";
import { loadMasterData } from "../data/masterData";
import { hasUnverifiedPrinting } from "../data/printings";
import type { MasterData } from "../data/types";

type SetRecord = MasterData["sets"][number];
type SetCodeRecord = MasterData["setcodes"][number];

// A setcode plus the set info we need to sort it.
type SetCodeRowData = {
  setcode: SetCodeRecord;
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

function compareSetCodeRows(a: SetCodeRowData, b: SetCodeRowData): number {
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
  // numeric: true sorts "LB-9" before "LB-10".
  return a.setcode.set_number.localeCompare(b.setcode.set_number, undefined, { numeric: true });
}

// One large "hero" image, plus a row of small clickable images when there is more than one.
function CardImages({ title, images }: { title: string; images: AvailableImage[] }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const selected = images[selectedImageIndex];
  if (selected === undefined) {
    return null;
  }

  let picker: ReactNode = null;
  if (images.length > 1) {
    picker = (
      <div className="image-picker">
        {images.map((image, position) => (
          <button
            key={image.index}
            type="button"
            aria-label={`Image ${position + 1} of ${images.length}`}
            aria-pressed={position === selectedImageIndex}
            onClick={() => setSelectedImageIndex(position)}
          >
            <img src={image.url} alt="" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="card-hero">
        <img src={selected.url} alt={title} />
      </div>
      {picker}
    </>
  );
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

  const rows: SetCodeRowData[] = [];
  for (const setcode of data.setcodes) {
    if (setcode.card_id !== card.card_id) {
      continue;
    }
    const set = setsById.get(setcode.set_id);
    let releaseDate: string | null = null;
    if (set !== undefined && set.release_date) {
      releaseDate = set.release_date.iso;
    }
    rows.push({
      setcode,
      releaseDate,
      region: set === undefined ? "" : set.region,
      setTitle: set === undefined ? setcode.set_id : set.title,
    });
  }
  rows.sort(compareSetCodeRows);

  let list: ReactNode;
  if (rows.length === 0) {
    list = <p className="muted">No printings for this card.</p>;
  } else {
    list = (
      <ul className="tile-grid tile-grid-cards">
        {rows.map((row) => (
          <li key={row.setcode.setcode_id}>
            <CardTile
              card={card}
              setcode={row.setcode}
              printingCount={row.setcode.printings.length}
              hasUnverifiedPrinting={hasUnverifiedPrinting(row.setcode.printings)}
              backLabel={card.title}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <h1>{card.title}</h1>
      {
        /* key makes this unique across different cards, otherwise React would reuse the component
          and thus the wrong images and index if navigating directly between card pages. */
      }
      <CardImages key={card.card_id} title={card.title} images={getAvailableImages(card)} />
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
        <BackLink fallbackTo="/cards" fallbackLabel="Cards" />
      </p>
      {content}
    </>
  );
}