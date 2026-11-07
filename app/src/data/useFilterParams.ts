import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { isGame } from "./games";

// The search text, and games & regions switched off live in the address bar
// (e.g. ?q=dark&hideGame=rush_duel&hideRegion=jp), so that going back from a detail page lands on
// exactly the filtered view that was left. Nothing in the URL means everything is on and the
// search is empty. Used by every page with a search bar and toggles.
const QUERY_PARAM = "q";
const HIDDEN_GAME_PARAM = "hideGame";
const HIDDEN_REGION_PARAM = "hideRegion";

export function useFilterParams() {
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

  // Sets one URL parameter to a list of values (an empty list removes it). Replaces the
  // current history entry instead of adding one, so typing doesn't make the Back button
  // step through each letter.
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

  return {
    query,
    disabledGames,
    disabledRegions,
    setSearchQuery: (value: string) => setParamValues(QUERY_PARAM, value === "" ? [] : [value]),
    setDisabledGames: (games: Iterable<string>) => setParamValues(HIDDEN_GAME_PARAM, games),
    setDisabledRegions: (regions: Iterable<string>) => setParamValues(HIDDEN_REGION_PARAM, regions),
  };
}