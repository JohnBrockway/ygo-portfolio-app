import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { GameToggles } from "../components/GameToggles";
import { RegionToggles } from "../components/RegionToggles";
import { SearchBar } from "../components/SearchBar";
import { SetTile } from "../components/SetTile";
import { getSetGames, isGame, toggleGame } from "../data/games";
import { loadSets } from "../data/masterData";
import { getRegions, toggleRegion } from "../data/regions";
import { matchesAllTokens, splitQuery } from "../data/search";
import type { CardSet } from "../data/types";

// The filters live in the address bar (e.g. /sets?q=dark&hideGame=rush_duel&hideRegion=jp),
// so going back from a set's page lands on exactly the filtered list that was left.
// Nothing in the URL means everything is on and the search is empty.
const QUERY_PARAM = "q";
const HIDDEN_GAME_PARAM = "hideGame";
const HIDDEN_REGION_PARAM = "hideRegion";

export function SetsPage() {
  const [sets, setSets] = useState<CardSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get(QUERY_PARAM) ?? "";
  const disabledGames = useMemo(
    () => new Set(searchParams.getAll(HIDDEN_GAME_PARAM).filter(isGame)),
    [searchParams],
  );
  const disabledRegions = useMemo(
    () => new Set(searchParams.getAll(HIDDEN_REGION_PARAM)),
    [searchParams],
  );

  // Sets one URL parameter to a list of values (an empty list removes it).
  // Replaces the current history entry instead of adding one, so typing
  // doesn't make the Back button step through each letter.
  function setParamValues(param: string, values: Iterable<string>) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete(param);
        // Sorted so the same filters always give the same URL.
        for (const value of Array.from(values).sort()) {
          next.append(param, value);
        }
        return next;
      },
      { replace: true },
    );
  }

  function setSearchQuery(value: string) {
    setParamValues(QUERY_PARAM, value === "" ? [] : [value]);
  }

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
            <SetTile set={set} />
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
        onToggle={(game) => setParamValues(HIDDEN_GAME_PARAM, toggleGame(disabledGames, game))}
      />
      <RegionToggles
        regions={regions}
        disabledRegions={disabledRegions}
        onToggle={(region) => setParamValues(HIDDEN_REGION_PARAM, toggleRegion(disabledRegions, region))}
      />
      {content}
    </>
  );
}