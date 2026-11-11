import { editionLabel } from "../data/editions";
import type { Edition } from "../data/types";

// One cell per edition the set has, side by side. TODO this is where the owned counter and wishlist button go.
export function EditionCells({ editions }: { editions: Edition[] }) {
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
      {editions.map((edition) => (
        <li key={edition} className="edition-cell">
          <div className="edition-label">{editionLabel(edition)}</div>
        </li>
      ))}
    </ul>
  );
}