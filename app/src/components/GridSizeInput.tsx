type GridSizeInputProps = {
  // "Columns" or "Rows": shown next to the box.
  label: string;
  // The box holds text, not a number, so that "empty" is something it can be while the user types.
  text: string;
  onTextChange: (text: string) => void;
  invalid: boolean;
};

// A box for one side of a binder's grid. It only accepts digits (anything else typed or pasted is dropped), and
// selects what it holds when it gets focus, so typing replaces the default instead of adding to it. Whether the
// number is in range is for the caller to decide (see BindersPage).
export function GridSizeInput({ label, text, onTextChange, invalid }: GridSizeInputProps) {
  return (
    <label className="grid-size-field">
      <span className="muted">{label}</span>
      <input
        className="text-input"
        type="text"
        inputMode="numeric"
        value={text}
        aria-invalid={invalid}
        onFocus={(event) => event.target.select()}
        onChange={(event) => onTextChange(event.target.value.replace(/\D/g, ""))}
      />
    </label>
  );
}