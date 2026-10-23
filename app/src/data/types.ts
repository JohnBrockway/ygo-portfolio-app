// Field names match the master data files exactly, so no conversion is needed after fetching.

export interface ReleaseDate {
  text: string;
  iso: string;
  source_region: string;
}

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
  release_date: ReleaseDate;
  printing_count: number;
}