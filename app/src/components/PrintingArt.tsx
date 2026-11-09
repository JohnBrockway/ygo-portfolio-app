import { getArtworkImageUrl } from "../data/images";
import type { Card, Printing } from "../data/types";

// The art a printing shows. Only verified printings have a known artwork; for the rest nothing is shown,
// because listing every image of the card would suggest the printing comes in all of them.
export function PrintingArt({ card, printing }: { card: Card; printing: Printing }) {
  if (!printing.verified || !printing.artwork) {
    return null;
  }

  const url = getArtworkImageUrl(card, printing.artwork);
  if (url === null) {
    return <p className="muted">Art {printing.artwork} has no image file.</p>;
  }

  return (
    <div className="printing-art">
      <img src={url} alt={`${card.title}, art ${printing.artwork}`} />
    </div>
  );
}