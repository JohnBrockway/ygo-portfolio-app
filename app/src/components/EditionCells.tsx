import { editionLabel } from "../data/editions";
import type { Edition } from "../data/types";
import { AddToListButton } from "./AddToListButton";
import { OneClickListButton } from "./OneClickListButton";
import { OwnedStepper } from "./OwnedStepper";

// One cell per edition the set has, side by side, each with the owned stepper and the list buttons.
export function EditionCells({
  editions,
  cardId,
  printingId,
}: {
  editions: Edition[];
  cardId: string;
  printingId: string;
}) {
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
            <OwnedStepper cardId={cardId} printingId={printingId} edition={edition} label={label} />
            <div className="list-buttons">
              <OneClickListButton cardId={cardId} printingId={printingId} edition={edition} label={label} />
              <AddToListButton cardId={cardId} printingId={printingId} edition={edition} label={label} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}