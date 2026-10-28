type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
};

export function SearchBar({ value, onChange, placeholder, label }: Props) {
  return (
    <input
      type="search"
      className="search-bar"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
      autoComplete="off"
    />
  );
}