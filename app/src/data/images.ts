import { DATA_BASE_URL } from "../config";
import type { Card, CardImage, CardSet } from "./types";

const SET_IMAGE_BASE = `${DATA_BASE_URL}/images/sets/`;
const CARD_IMAGE_BASE = `${DATA_BASE_URL}/images/cards/`;

// An image of a card that we can actually show.
export type AvailableImage = {
  index: string;
  url: string;
};

// The master data has an image file name only if the file exists; null means show the placeholder.
function imageUrl(base: string, file: string | null): string | null {
  return file === null ? null : `${base}${encodeURIComponent(file)}`;
}

export function setImageUrl(set: CardSet): string | null {
  return imageUrl(SET_IMAGE_BASE, set.image);
}

export function cardImageUrl(image: CardImage): string | null {
  return imageUrl(CARD_IMAGE_BASE, image.file);
}

// The images of a card that exist, in the order to show them.
export function getAvailableImages(card: Card): AvailableImage[] {
  const images: AvailableImage[] = [];
  for (const image of card.images) {
    const url = cardImageUrl(image);
    if (url !== null) {
      images.push({ index: image.index, url });
    }
  }
  return images;
}

// The URL of the card's default image, or null (show the placeholder) if it has no valid image files.
export function getDefaultImageUrl(card: Card): string | null {
  const defaultImage = getAvailableImages(card)[0];
  return defaultImage === undefined ? null : defaultImage.url;
}