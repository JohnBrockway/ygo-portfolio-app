import { TrashIcon } from "./ActionIcons";

// A round trash button on the top right corner of its positioned parent: the item of a tile grid for a tile, the
// frame of a page for a binder page.
export function CornerRemoveButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="corner-remove-button"
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <TrashIcon />
    </button>
  );
}