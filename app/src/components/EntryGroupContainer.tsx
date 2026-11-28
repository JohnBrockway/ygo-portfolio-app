import type { ReactNode } from "react";
import type { TileSelection } from "../data/tileSelection";

// A live group on a list page that is open (see GroupTile for it folded up): a bordered container around the tiles of its
// members, which show that they are one group. The caller puts it in a list item of a tile grid and the tiles in a nested
// tile grid. Under the header a line says which member covers the group (carriedBy, a description of it) where one does.
// The header is a button whose action depends on selection, which is null normally: then it folds the group up
// (onCollapse); in select mode it picks the group as a whole instead (the members have their own selections), and nothing
// folds the group up, so onCollapse is never called then.
export function EntryGroupContainer({
  title,
  coveredBy,
  selection,
  onCollapse,
  children,
}: {
  title: string;
  coveredBy: string | null;
  selection: TileSelection | null;
  onCollapse: () => void;
  children: ReactNode;
}) {
  let containerClass = "entry-group";
  let header: ReactNode;
  if (selection === null) {
    header = (
      <button
        className="entry-group-header entry-group-header-button"
        type="button"
        aria-expanded={true}
        aria-label={`Collapse group ${title}`}
        title={title}
        onClick={onCollapse}
      >
        {title}
      </button>
    );
  } else {
    if (selection.isSelected) {
      containerClass += " entry-group-selected";
    }
    header = (
      <button
        className="entry-group-header entry-group-header-button"
        type="button"
        aria-pressed={selection.isSelected}
        title={title}
        onClick={selection.onToggle}
      >
        {title}
      </button>
    );
  }

  let coveredByLine: ReactNode = null;
  if (coveredBy !== null) {
    coveredByLine = <div className="entry-group-carried-by">Covered by {coveredBy}</div>;
  }

  return (
    <div className={containerClass} role="group" aria-label={title}>
      {header}
      {coveredByLine}
      {children}
    </div>
  );
}