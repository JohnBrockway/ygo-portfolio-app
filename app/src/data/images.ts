import { DATA_BASE_URL } from "../config";
import type { Card, CardSet } from "./types";

const SET_IMAGE_BASE = `${DATA_BASE_URL}/images/sets/`;
const CARD_IMAGE_BASE = `${DATA_BASE_URL}/images/cards/`;

// Must match local_image_name() and output_name() in the pipeline's fetch_image_util.py:
// strip a File:/Image: prefix, spaces become underscores, thumbnails are saved as "<name>.webp".
function imageUrl(base: string, wikiName: string | null | undefined): string | null {
  const name = (wikiName ?? "")
    .trim()
    .replace(/^(file|image):/i, "")
    .replace(/ /g, "_");
  if (name === "" || name.includes("/") || name.includes("\\") || name.startsWith(".")) {
    return null;
  }
  return `${base}${encodeURIComponent(name)}.webp`;
}

export function setImageUrl(set: CardSet): string | null {
  return imageUrl(SET_IMAGE_BASE, set.image);
}

// A card's tile shows its first image; cards with no images get null (the tile's placeholder).
export function cardImageUrl(card: Card): string | null {
  return imageUrl(CARD_IMAGE_BASE, card.images[0]?.file);
}