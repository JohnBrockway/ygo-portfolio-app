import type { ReactNode } from "react";
import type { BinderCardWithPrinting } from "../data/binderPlacements";
import { editionLabel } from "../data/editions";
import { getPrintingImageUrl } from "../data/images";
import { printingName } from "../data/printings";

// A binder card in little room: the image of its printing, with a caption over the bottom of it that names the card and
// gives its set number. Not a button or a link; the caller puts it in one (a binder slot, a card pool card). It fills
// the width it is given, as tall as a card image, and how much of the caption shows depends on that width (see
// index.css).
export function BinderCardCompact({ binderCard }: { binderCard: BinderCardWithPrinting }) {
  const { record, found } = binderCard;

  if (found === null) {
    return (
      <div className="compact-card compact-card-missing">
        <span>Missing</span>
        <span>{record.printingId}</span>
      </div>
    );
  }

  const { card, printing, setcode } = found;
  const imageUrl = getPrintingImageUrl(card, printing);

  // The caption names the card, so the image itself needs no text.
  let image: ReactNode = null;
  if (imageUrl !== null) {
    image = <img className="compact-card-image" src={imageUrl} alt="" loading="lazy" />;
  }

  // A synthetic set number is one the data made up, so it means nothing to show (like on the tiles).
  let setNumber: ReactNode = null;
  if (!setcode.set_number_synthetic) {
    setNumber = <div className="compact-card-set-number">{setcode.set_number}</div>;
  }

  return (
    <div className="compact-card">
      {image}
      <div className="compact-card-caption">
        <div className="compact-card-name">{card.title}</div>
        {setNumber}
        <div className="compact-card-detail">
          {printingName(printing, setcode.printings)} · {editionLabel(record.edition)}
        </div>
      </div>
    </div>
  );
}