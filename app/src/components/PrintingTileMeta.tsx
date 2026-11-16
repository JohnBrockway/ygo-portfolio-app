import type { ReactNode } from "react";
import { editionLabel } from "../data/editions";
import type { FoundPrinting } from "../data/foundPrintings";
import { printingName } from "../data/printings";
import type { Edition } from "../data/types";

// The meta rows of a tile for one specific printing + edition: set number and region, then which printing and
// edition. extraTag goes at the end of the second row (ex. on Owned, this is the quantity).
export function PrintingTileMeta({
  found,
  edition,
  extraTag = null,
}: {
  found: FoundPrinting;
  edition: Edition;
  extraTag?: ReactNode;
}) {
  const { printing, setcode, set } = found;

  return (
    <>
      <div className="tile-meta">
        {setcode.set_number_synthetic ? null : <span className="tag">{setcode.set_number}</span>}
        <span className="tag">{set.region}</span>
      </div>
      <div className="tile-meta">
        <span className="muted">
          {printingName(printing, setcode.printings)} · {editionLabel(edition)}
        </span>
        {extraTag}
      </div>
    </>
  );
}