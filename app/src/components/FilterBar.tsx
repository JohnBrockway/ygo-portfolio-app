import type { Game } from "../data/types";
import { toggleInSet } from "../data/toggleInSet";
import type { FilterParams } from "../data/useFilterParams";
import { GameToggles } from "./GameToggles";
import { RegionToggles } from "./RegionToggles";
import { SearchBar } from "./SearchBar";

type FilterBarProps = {
  // What useFilterParams returned: the search text and switched-off games and regions, and how to change them.
  filters: FilterParams;
  searchLabel: string;
  // Every game and region the page's data has, not only the ones that are on, so a switched-off one keeps its button.
  games: Game[];
  regions: string[];
};

// The search bar and the game and region toggles at the top of a page with filters.
export function FilterBar({ filters, searchLabel, games, regions }: FilterBarProps) {
  return (
    <>
      <SearchBar
        value={filters.query}
        onChange={filters.setSearchQuery}
        placeholder={searchLabel}
        label={searchLabel}
      />
      <GameToggles
        games={games}
        disabledGames={filters.disabledGames}
        onToggle={(game) => filters.setDisabledGames(toggleInSet(filters.disabledGames, game))}
      />
      <RegionToggles
        regions={regions}
        disabledRegions={filters.disabledRegions}
        onToggle={(region) => filters.setDisabledRegions(toggleInSet(filters.disabledRegions, region))}
      />
    </>
  );
}