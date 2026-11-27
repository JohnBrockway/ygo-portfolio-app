import { PencilIcon } from "./ActionIcons";

export function SelectButton({ onClick }: { onClick: () => void }) {
  const label = "Select entries to group them, or to change a group";
  return (
    <button className="floating-select-button" type="button" aria-label={label} title={label} onClick={onClick}>
      <PencilIcon />
    </button>
  );
}