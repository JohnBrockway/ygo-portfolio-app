import { useMemo } from "react";
import type { ReactNode } from "react";
import { FilterBar } from "../components/FilterBar";
import { SetTile } from "../components/SetTile";
import { getSetGames } from "../data/games";
import { loadSets } from "../data/masterData";
import { getRegions } from "../data/regions";
import { matchesAllTokens, splitQuery } from "../data/search";
import { useFilterParams } from "../data/useFilterParams";
import { useLoadOnMount } from "../data/useLoadOnMount";

// This page's name in the Back links of the pages its tiles open.
const BACK_LABEL = "set search";

export function SetsPage() {
  const { data: sets, error } = useLoadOnMount(loadSets);
  const filters = useFilterParams();
  const { query, disabledGames, disabledRegions } = filters;

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
  } else if (games.length > 0 && games.every((game) => disabledGames.has(game))) {
    content = <p className="muted">No games selected.</p>;
  } else if (regions.length > 0 && regions.every((region) => disabledRegions.has(region))) {
    content = <p className="muted">No regions selected.</p>;
  } else if (visibleSets.length === 0) {
    content = <p className="muted">No sets match “{query.trim()}”.</p>;
  } else {
    content = (
      <ul className="tile-grid">
        {visibleSets.map((set) => (
          <li key={set.set_id}>
            <SetTile set={set} backLabel={BACK_LABEL} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <h1>Sets</h1>
      <p className="muted">Browse sets and open one to see its printings.</p>
      <FilterBar filters={filters} searchLabel="Filter sets by title" games={games} regions={regions} />
      {content}
    </>
  );
}