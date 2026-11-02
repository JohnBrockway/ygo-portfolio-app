import { DATA_BASE_URL } from "../config";
import type { CardSet } from "./types";

const SET_IMAGE_BASE = `${DATA_BASE_URL}/images/sets/`;

// Must match local_image_name() and output_name() in the pipeline's fetch_image_util.py:
// strip a File:/Image: prefix, spaces become underscores, thumbnails are saved as "<name>.webp".
export function setImageUrl(set: CardSet): string | null {
  const name = (set.image ?? "")
    .trim()
    .replace(/^(file|image):/i, "")
    .replace(/ /g, "_");
  if (name === "" || name.includes("/") || name.includes("\\") || name.startsWith(".")) {
    return null;
  }
  return `${SET_IMAGE_BASE}${encodeURIComponent(name)}.webp`;
}