import { editionLabel } from "../data/editions";
import type { Edition } from "../data/types";
import { OwnedStepper } from "./OwnedStepper";
import { WishlistButton } from "./WishlistButton";

// One cell per edition the set has, side by side, each with the owned stepper and the list button.
export function EditionCells({ editions, printingId }: { editions: Edition[]; printingId: string }) {
  if (editions.length === 0) {
    return (
      <ul className="edition-cells">
        <li className="edition-cell">
          <div className="edition-label">No edition</div>
        </li>
      </ul>
    );
  }

  return (
    <ul className="edition-cells">
      {editions.map((edition) => {
        const label = editionLabel(edition);
        return (
          <li key={edition} className="edition-cell">
            <div className="edition-label">{label}</div>
            <OwnedStepper printingId={printingId} edition={edition} label={label} />
            <WishlistButton printingId={printingId} edition={edition} label={label} />
          </li>
        );
      })}
    </ul>
  );
}