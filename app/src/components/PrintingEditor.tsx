import { getAvailableImages } from "../data/images";
import type { OverrideDraft } from "../data/overrideDrafts";
import type { Card, Printing } from "../data/types";

// Edit mode's version of PrintingArt: image picker & label text field.
// printing is the printing as shown (draft already applied if it has one); hasDraft says whether it has one.
// onDraftChange gets the new draft, or null to discard the printing's draft.
export function PrintingEditor({
  card,
  setcodeId,
  printing,
  hasDraft,
  onDraftChange,
}: {
  card: Card;
  setcodeId: string;
  printing: Printing;
  hasDraft: boolean;
  onDraftChange: (draft: OverrideDraft | null) => void;
}) {
  const images = getAvailableImages(card);
  if (images.length === 0) {
    return <p className="muted">This card has no image files, so its artwork can't be tagged.</p>;
  }

  function saveDraft(artwork: string, label: string | null) {
    const image = card.images.find((candidate) => candidate.index === artwork);
    if (image === undefined || image.file === null) {
      return;
    }
    onDraftChange({
      setcode_id: setcodeId,
      rarity: printing.rarity,
      variant: printing.variant,
      artwork,
      image: image.file,
      label,
    });
  }

  function handleLabelChange(text: string) {
    if (printing.artwork === null) {
      return;
    }
    saveDraft(printing.artwork, text === "" ? null : text);
  }

  return (
    <>
      <div className="art-choices">
        {images.map((image) => (
          <button
            key={image.index}
            type="button"
            aria-label={`Art ${image.index}`}
            aria-pressed={image.index === printing.artwork}
            onClick={() => saveDraft(image.index, printing.label)}
          >
            <img src={image.url} alt="" />
            <span>{image.index}</span>
          </button>
        ))}
      </div>
      {printing.artwork === null ? null : (
        <label className="muted">
          <input
            type="text"
            className="text-input"
            value={printing.label ?? ""}
            placeholder="Further distinction (optional; ex. stamp, title colour)"
            onChange={(event) => handleLabelChange(event.target.value)}
          />
        </label>
      )}
      {hasDraft ? (
        <p>
          <button type="button" className="action-button" onClick={() => onDraftChange(null)}>
            Discard draft
          </button>
        </p>
      ) : null}
    </>
  );
}