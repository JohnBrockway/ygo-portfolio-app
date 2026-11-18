type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  // Shown in the box while it is empty, and what a screen reader calls the box.
  label: string;
};

export function SearchBar({ value, onChange, label }: SearchBarProps) {
  return (
    <input
      type="search"
      className="search-bar"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={label}
      aria-label={label}
      autoComplete="off"
    />
  );
}