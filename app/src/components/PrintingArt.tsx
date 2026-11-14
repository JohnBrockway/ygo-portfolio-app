import { getArtworkImageUrl } from "../data/images";
import type { Card } from "../data/types";
import type { WorkingPrinting } from "../data/workingPrintings";

// The art a printing shows. Only verified printings have a known artwork.
// (Edit mode uses PrintingEditor instead.)
export function PrintingArt({ card, printing }: { card: Card; printing: WorkingPrinting }) {
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