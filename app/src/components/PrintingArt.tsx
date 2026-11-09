import { getArtworkImageUrl, getAvailableImages } from "../data/images";
import type { Card, Printing } from "../data/types";

// The art a printing shows. Only verified printings have a known artwork, except in
// Edit mode which does list them all (as the choices the printing can be tagged to be).
export function PrintingArt({ card, printing, editMode }: { card: Card; printing: Printing; editMode: boolean }) {
  if (printing.verified && printing.artwork) {
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

  if (!editMode) {
    return null;
  }

  const images = getAvailableImages(card);
  if (images.length === 0) {
    return null;
  }
  return (
    <>
      <div className="printing-art">
        {images.map((image) => (
          <img key={image.index} src={image.url} alt={`${card.title}, art ${image.index}`} />
        ))}
      </div>
      <p className="muted">Art not verified.</p>
    </>
  );
}