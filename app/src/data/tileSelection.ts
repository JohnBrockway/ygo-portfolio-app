// Whether a tile (or the container of a group) is picked in select mode, and what tapping it does. A tile that is not in
// select mode has no selection (null), and then it is a link, not a button.
export interface TileSelection {
  isSelected: boolean;
  onToggle: () => void;
}

export function selectableTileClass(tileClass: string, selection: TileSelection): string {
  let className = `${tileClass} tile-selectable`;
  if (selection.isSelected) {
    className += " tile-selected";
  }
  return className;
}