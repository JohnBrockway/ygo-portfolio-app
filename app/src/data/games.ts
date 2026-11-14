import type { Card, CardSet, Game } from "./types";

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

// Same, for sets. A set can span several games.
export function getSetGames(sets: CardSet[]): Game[] {
  const games = new Set<Game>();
  for (const set of sets) {
    for (const game of set.games) {
      games.add(game);
    }
  }
  return Array.from(games).sort();
}

// True if a string from outside the app (e.g. the address bar) names a known game.
export function isGame(value: string): value is Game {
  return value in GAME_LABELS;
}