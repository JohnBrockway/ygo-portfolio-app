import type { Card, Game } from "./types";

// The name shown for each game.
export const GAME_LABELS: Record<Game, string> = {
  duel_monsters: "Duel Monsters",
  rush_duel: "Rush Duel",
};

// Every game that appears in the list, in a stable order.
export function getGames(cards: Card[]): Game[] {
  const games = new Set<Game>();
  for (const card of cards) {
    games.add(card.game);
  }
  return Array.from(games).sort();
}

// Returns a new set (React state must not be mutated in place).
export function toggleGame(disabledGames: Set<Game>, game: Game): Set<Game> {
  const next = new Set(disabledGames);
  if (next.has(game)) {
    next.delete(game);
  } else {
    next.add(game);
  }
  return next;
}