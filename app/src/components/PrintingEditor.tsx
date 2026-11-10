import { getAvailableImages } from "../data/images";
import { makeDraft } from "../data/overrideDrafts";
import type { OverrideDraft } from "../data/overrideDrafts";
import type { DisplayPrinting } from "../data/printings";
import type { DraftKind } from "../data/printingRows";
import type { Card } from "../data/types";

// Edit mode's version of PrintingArt: image picker & label text field.
// printing is the printing as shown (draft already applied if it has one); draftKind describes what level of draft it is.
// onDraftChange gets the new draft, or null to discard the printing's draft (which removes an added version).
export function PrintingEditor({
  card,
  setcodeId,
  printing,
  draftKind,
  onDraftChange,
}: {
  card: Card;
  setcodeId: string;
  printing: DisplayPrinting;
  draftKind: DraftKind;
  onDraftChange: (draft: OverrideDraft | null) => void;
}) {
  const images = getAvailableImages(card);
  if (images.length === 0) {
    return <p className="muted">This card has no image files, so its artwork can't be tagged.</p>;
  }

  function saveDraft(artwork: string, label: string | null) {
    const draft = makeDraft(card, setcodeId, printing.rarity, printing.variant, artwork, label);
    if (draft !== null) {
      onDraftChange(draft);
    }
  }

  function handleLabelChange(text: string) {
    if (printing.artwork === null) {
      return;
    }
    saveDraft(printing.artwork, text === "" ? null : text);
  }

  let discardLabel = "Discard draft";
  if (draftKind === "added") {
    discardLabel = "Remove version";
  } else if (draftKind === "pending") {
    discardLabel = "Cancel";
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
      {draftKind === "pending" ? <p className="muted">Pick an artwork to keep this version.</p> : null}
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
      {draftKind === "none" ? null : (
        <p>
          <button type="button" className="action-button" onClick={() => onDraftChange(null)}>
            {discardLabel}
          </button>
        </p>
      )}
    </>
  );
}