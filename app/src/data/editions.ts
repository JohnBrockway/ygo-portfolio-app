import type { Edition } from "./types";

const EDITION_LABELS: Record<Edition, string> = {
  "1st_edition": "1st Edition",
  limited: "Limited",
  unlimited: "Unlimited",
};

export function editionLabel(edition: Edition): string {
  return EDITION_LABELS[edition];
}