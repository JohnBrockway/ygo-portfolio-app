// The CSS class that tints a tile to hint at its card type.
export function tileTypeClass(cardType: string): string {
  switch (cardType) {
    case "Monster":
      return "tile tile-monster";
    case "Spell":
      return "tile tile-spell";
    case "Trap":
      return "tile tile-trap";
    case "Synchro":
      return "tile tile-synchro";
    case "Ritual":
      return "tile tile-ritual";
    case "Xyz":
      return "tile tile-xyz";
    case "Fusion":
      return "tile tile-fusion";
    case "Link":
      return "tile tile-link";
    case "Pendulum":
      return "tile tile-pendulum";
    default:
      return "tile";
  }
}