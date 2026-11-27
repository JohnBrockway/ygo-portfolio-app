import type { ReactNode } from "react";
import type { TileSelection } from "../data/tileSelection";

// A live group on a list page: a bordered container around the tiles of its members, which show that they are one
// group. The caller puts it in a list item of a tile grid and the tiles in a nested tile grid. selection is null
// normally; in select mode it is what picks the group as a whole, and the header becomes the button for that (the
// members have their own selections).
export function EntryGroupContainer({
  title,
  selection,
  children,
}: {
  title: string;
  selection: TileSelection | null;
  children: ReactNode;
}) {
  let containerClass = "entry-group";
  let header: ReactNode;
  if (selection === null) {
    header = <div className="entry-group-header">{title}</div>;
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

  return (
    <div className={containerClass} role="group" aria-label={title}>
      {header}
      {children}
    </div>
  );
}