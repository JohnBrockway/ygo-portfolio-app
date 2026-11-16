// The CSS class that tints a tile to hint at its card type.
export function tileTypeClass(cardType: string): string {
  switch (cardType) {
    case "Monster":
      return "tile tile-monster";
    case "Spell":
      return "tile tile-spell";
    case "Trap":
      return "tile tile-trap";
    default:
      return "tile";
  }
}