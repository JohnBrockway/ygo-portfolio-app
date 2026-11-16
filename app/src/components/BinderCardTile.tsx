import { useState } from "react";
import type { ReactNode } from "react";
import { removeCardFromBinder } from "../data/binders";
import type { BinderCardRecord } from "../data/bindersDb";
import { editionLabel } from "../data/editions";
import type { RecordWithFoundPrinting } from "../data/foundPrintings";
import { getVerifiedArtworks } from "../data/printings";
import { tileTypeClass } from "../data/tileTypeClass";
import { CornerRemoveButton } from "./CornerRemoveButton";
import { MissingPrintingTile } from "./MissingPrintingTile";
import { PrintingTileMeta } from "./PrintingTileMeta";
import { TileContent } from "./TileContent";

// One card in a binder's pool (one physical copy): the specific printing and edition as a tile, with a button on its
// corner that removes the card from the binder. Not a link, because pool tiles are for placing in slots, not for opening.
export function BinderCardTile({
  binderCard,
  changesDisabled,
}: {
  binderCard: RecordWithFoundPrinting<BinderCardRecord>;
  changesDisabled: boolean;
}) {
  const { record, found } = binderCard;
  const [removing, setRemoving] = useState(false);

  const editionText = editionLabel(record.edition);
  const name = found === null ? record.printingId : found.card.title;

  async function handleRemove() {
    setRemoving(true);
    await removeCardFromBinder(record.id);
    // On success this tile is gone; on failure it stays, and the banner explains.
    setRemoving(false);
  }

  let tile: ReactNode;
  if (found === null) {
    tile = <MissingPrintingTile printingId={record.printingId} edition={record.edition} />;
  } else {
    tile = (
      <div className={tileTypeClass(found.card.card_type)} title={found.card.title}>
        <TileContent
          card={found.card}
          artworks={getVerifiedArtworks([found.printing])}
          hasUnverifiedPrinting={!found.printing.verified}
        >
          <PrintingTileMeta found={found} edition={record.edition} />
        </TileContent>
      </div>
    );
  }

  return (
    <>
      {tile}
      <CornerRemoveButton
        label={`Remove ${name} (${editionText}) from this binder`}
        disabled={changesDisabled || removing}
        onClick={handleRemove}
      />
    </>
  );
}