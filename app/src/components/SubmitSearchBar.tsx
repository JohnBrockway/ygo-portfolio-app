import { useState } from "react";
import type { SubmitEvent } from "react";
import { SearchBar } from "./SearchBar";

type SubmitSearchBarProps = {
  searchLabel: string;
  // Called with the trimmed text when the person presses Enter or the button. Not called for blank text.
  onSubmit: (query: string) => void;
};

// A search bar that does nothing until it is submitted. The live version is FilterBar.
export function SubmitSearchBar({ searchLabel, onSubmit }: SubmitSearchBarProps) {
  const [query, setQuery] = useState("");

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery === "") {
      return;
    }
    onSubmit(trimmedQuery);
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <SearchBar value={query} onChange={setQuery} placeholder={searchLabel} label={searchLabel} />
      <button type="submit" className="action-button">Search</button>
    </form>
  );
}