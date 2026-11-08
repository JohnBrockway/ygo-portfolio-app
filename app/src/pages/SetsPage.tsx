import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { GameToggles } from "../components/GameToggles";
import { RegionToggles } from "../components/RegionToggles";
import { SearchBar } from "../components/SearchBar";
import { SetTile } from "../components/SetTile";
import { getSetGames, toggleGame } from "../data/games";
import { loadSets } from "../data/masterData";
import { getRegions, toggleRegion } from "../data/regions";
import { matchesAllTokens, splitQuery } from "../data/search";
import type { CardSet } from "../data/types";
import { useFilterParams } from "../data/useFilterParams";

export function SetsPage() {
  const [sets, setSets] = useState<CardSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { query, disabledGames, disabledRegions, setSearchQuery, setDisabledGames, setDisabledRegions } =
    useFilterParams();

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

  const tokens = useMemo(() => splitQuery(query), [query]);

  // Games and regions come from the full unfiltered list, so toggling one off never removes its button.
  const games = useMemo(() => (sets === null ? [] : getSetGames(sets)), [sets]);
  const regions = useMemo(() => (sets === null ? [] : getRegions(sets)), [sets]);

  const visibleSets = useMemo(() => {
    if (sets === null) {
      return [];
    }
    return sets.filter(
      (set) =>
        // A set spanning several games stays visible while any one of them is on.
        set.games.some((game) => !disabledGames.has(game)) &&
        !disabledRegions.has(set.region) &&
        matchesAllTokens(set.title, tokens),
    );
  }, [sets, tokens, disabledGames, disabledRegions]);

  let content: ReactNode;
  if (error !== null) {
    content = <p>Couldn't load sets: {error}</p>;
  } else if (sets === null) {
    content = <p className="muted">Loading sets…</p>;
  } else if (sets.length === 0) {
    content = <p className="muted">No sets found.</p>;
  } else if (games.every((game) => disabledGames.has(game))) {
    content = <p className="muted">No games selected.</p>;
  } else if (regions.every((region) => disabledRegions.has(region))) {
    content = <p className="muted">No regions selected.</p>;
  } else if (visibleSets.length === 0) {
    content = <p className="muted">No sets match “{query.trim()}”.</p>;
  } else {
    content = (
      <ul className="tile-grid">
        {visibleSets.map((set) => (
          <li key={set.set_id}>
            <SetTile set={set} backLabel="set search" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <h1>Sets</h1>
      <p className="muted">Browse sets and open one to see its printings.</p>
      <SearchBar
        value={query}
        onChange={setSearchQuery}
        placeholder="Filter sets by title"
        label="Filter sets by title"
      />
      <GameToggles
        games={games}
        disabledGames={disabledGames}
        onToggle={(game) => setDisabledGames(toggleGame(disabledGames, game))}
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