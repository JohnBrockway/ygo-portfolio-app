import { useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { SetCodeTile } from "../components/SetCodeTile";
import { setNumberCollator } from "../data/collators";
import { getAvailableImages } from "../data/images";
import type { AvailableImage } from "../data/images";
import { indexBy } from "../data/indexBy";
import { loadMasterData } from "../data/masterData";
import type { MasterData, SetCode } from "../data/types";
import { useLoadOnMount } from "../data/useLoadOnMount";

// A setcode plus the set info we need to sort it.
type SetCodeWithSetInfo = {
  setcode: SetCode;
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

function compareSetCodesWithSetInfo(a: SetCodeWithSetInfo, b: SetCodeWithSetInfo): number {
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
  return setNumberCollator.compare(a.setcode.set_number, b.setcode.set_number);
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

  const setsById = indexBy(data.sets, (set) => set.set_id);

  // Either record can be missing in the data; fall back to ids instead of breaking the page.
  const setcodes = data.setcodes
    .filter((setcode) => setcode.card_id === card.card_id)
    .map((setcode): SetCodeWithSetInfo => {
      const set = setsById.get(setcode.set_id);
      let releaseDate: string | null = null;
      if (set !== undefined && set.release_date) {
        releaseDate = set.release_date.iso;
      }
      return {
        setcode,
        releaseDate,
        region: set === undefined ? "" : set.region,
        setTitle: set === undefined ? setcode.set_id : set.title,
      };
    })
    .sort(compareSetCodesWithSetInfo);

  let list: ReactNode;
  if (setcodes.length === 0) {
    list = <p className="muted">No printings for this card.</p>;
  } else {
    list = (
      <ul className="tile-grid tile-grid-cards">
        {setcodes.map(({ setcode }) => (
          <li key={setcode.setcode_id}>
            <SetCodeTile card={card} setcode={setcode} backLabel={card.title} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <h1>{card.title}</h1>
      <CardImages title={card.title} images={getAvailableImages(card)} />
      {list}
    </>
  );
}

export function CardDetailPage() {
  const { cardId } = useParams();
  const { data, error } = useLoadOnMount(loadMasterData);

  let content: ReactNode;
  if (error !== null) {
    content = <p>Couldn't load printings: {error}</p>;
  } else if (data === null) {
    content = <p className="muted">Loading printings…</p>;
  } else {
    // key makes this unique per card page, otherwise React would reuse the component (and the selected image index)
    // if navigating directly between card pages.
    content = <CardPrintings key={cardId} data={data} cardId={cardId} />;
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