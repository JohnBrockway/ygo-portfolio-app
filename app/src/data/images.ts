import { DATA_BASE_URL } from "../config";
import type { Card, CardSet } from "./types";

const SET_IMAGE_BASE = `${DATA_BASE_URL}/images/sets/`;
const CARD_IMAGE_BASE = `${DATA_BASE_URL}/images/cards/`;

// The master data names each thumbnail (thumb) only if the file exists
function imageUrl(base: string, thumb: string | undefined): string | null {
  return thumb === undefined ? null : `${base}${encodeURIComponent(thumb)}`;
}

export function setImageUrl(set: CardSet): string | null {
  return imageUrl(SET_IMAGE_BASE, set.thumb);
}

// A card's tile shows its first image that has a thumbnail; null (the placeholder) if none do.
export function cardImageUrl(card: Card): string | null {
  return imageUrl(CARD_IMAGE_BASE, card.images.find((image) => image.thumb !== undefined)?.thumb);
}