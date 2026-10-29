import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { RegionToggles } from "../components/RegionToggles";
import { SearchBar } from "../components/SearchBar";
import { SetMeta } from "../components/SetMeta";
import { loadSets } from "../data/masterData";
import { getRegions, toggleRegion } from "../data/regions";
import { matchesAllTokens, splitQuery } from "../data/search";
import type { CardSet } from "../data/types";

export function SetsPage() {
  const [sets, setSets] = useState<CardSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [disabledRegions, setDisabledRegions] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    // Ignore the result if the page was left before the fetch finished.
    let cancelled = false;

    loadSets()
      .then((loadedSets) => {
        if (!cancelled) {
          setSets(loadedSets);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const regions = useMemo(() => (sets === null ? [] : getRegions(sets)), [sets]);

  let content: ReactNode;
  if (error !== null) {
    content = <p>Couldn't load sets: {error}</p>;
  } else if (sets === null) {
    content = <p className="muted">Loading sets…</p>;
  } else if (sets.length === 0) {
    content = <p className="muted">No sets found.</p>;
  } else if (regions.every((region) => disabledRegions.has(region))) {
    content = <p className="muted">No regions selected.</p>;
  } else {
    const tokens = splitQuery(query);
    const visibleSets = sets.filter(
      (set) => !disabledRegions.has(set.region) && matchesAllTokens(set.title, tokens)
    );

    if (visibleSets.length === 0) {
      content = <p className="muted">No sets match “{query.trim()}”.</p>;
    } else {
      content = (
        <ul className="row-list">
          {visibleSets.map((set) => (
            <li key={set.set_id}>
              <Link to={`/sets/${set.set_id}`} className="row">
                <div className="row-title">{set.title}</div>
                <SetMeta set={set} />
              </Link>
            </li>
          ))}
        </ul>
      );
    }
  }

  return (
    <>
      <h1>Sets</h1>
      <p className="muted">Browse sets and open one to see its printings.</p>
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Filter sets by title"
        label="Filter sets by title"
      />
      <RegionToggles
        regions={regions}
        disabledRegions={disabledRegions}
        onToggle={(region) => setDisabledRegions(toggleRegion(disabledRegions, region))}
      />
      {content}
    </>
  );
}