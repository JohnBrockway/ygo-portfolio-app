// Field names match the master data files exactly, so no conversion is needed after fetching.

export interface ReleaseDate {
  text: string;
  iso: string;
  source_region: string;
}

// The fixed option list the pipeline validates against.
export type Edition = "1st_edition" | "limited" | "unlimited";

export interface CardSet {
  set_id: string;
  page_id: number;
  title: string;
  region: string;
  name: string;
  names: {
    en?: string;
    ja?: string;
    romaji?: string;
  };
  image: string;
  prefix: string | null;
  postfix: string | null;
  release_date: ReleaseDate | null;
  editions: Edition[];
  printing_count: number;
}

export interface Printing {
  printing_id: string;
  card_id: string;
  set_id: string;
  set_number: string;
  set_number_synthetic: boolean;
  rarity: string;
}

export interface CardImage {
  index: string;
  file: string;
  art_only: boolean;
}

export interface Card {
  card_id: string;
  pageid: number;
  title: string;
  name_ja: string;
  konami_id: string;
  password: string;
  card_type: string;
  images: CardImage[];
}

export interface MasterData {
  sets: CardSet[];
  printings: Printing[];
  cards: Card[];
}