import { GAME_LABELS } from "../data/games";
import type { Game } from "../data/types";

type GameTogglesProps = {
  games: Game[];
  disabledGames: Set<Game>;
  onToggle: (game: Game) => void;
};

export function GameToggles({ games, disabledGames, onToggle }: GameTogglesProps) {
  // With fewer than two games there is nothing to choose between.
  if (games.length < 2) {
    return null;
  }

  return (
    <div className="filter-toggles" role="group" aria-label="Filter by game">
      {games.map((game) => {
        const isOn = !disabledGames.has(game);
        return (
          <button
            key={game}
            type="button"
            className={isOn ? "filter-toggle" : "filter-toggle filter-toggle-off"}
            aria-pressed={isOn}
            onClick={() => onToggle(game)}
          >
            {GAME_LABELS[game]}
          </button>
        );
      })}
    </div>
  );
}