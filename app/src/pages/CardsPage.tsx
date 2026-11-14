import { useMemo } from "react";
import type { ReactNode } from "react";
import { CardTile } from "../components/CardTile";
import { GameToggles } from "../components/GameToggles";
import { RegionToggles } from "../components/RegionToggles";
import { SearchBar } from "../components/SearchBar";
import { SetCodeTile } from "../components/SetCodeTile";
import { setNumberCollator, titleCollator } from "../data/collators";
import { getGames, toggleGame } from "../data/games";
import { indexBy } from "../data/indexBy";
import { loadMasterData } from "../data/masterData";
import { getCardIdsWithUnverifiedPrintings, hasUnverifiedPrinting } from "../data/printings";
import { getRegions, toggleRegion } from "../data/regions";
import { matchesAllTokens, matchesSetNumberAndTitle, splitQuery } from "../data/search";
import type { Card, CardSet, MasterData, SetCode } from "../data/types";
import { useFilterParams } from "../data/useFilterParams";
import { useLoadOnMount } from "../data/useLoadOnMount";

// A setcode prepared for searching, with the card it belongs to (needed to show its tile).
type SearchableSetCode = {
  setcode: SetCode;
  card: Card;
  numberText: string;
  titleText: string;
};

// Keeps the DOM small; the heading shows the full match count.
const MAX_RESULTS = 50;

// This page's name in the Back links of the pages its tiles open.
const BACK_LABEL = "card search";

// Callers pass a non-empty token list and cards already sorted by title.
function findCardMatches(sortedCards: Card[], tokens: string[]): Card[] {
  const firstToken = tokens[0].toLowerCase();

  // Titles that start with the first token come first. Both groups keep the
  // input's alphabetical order, so no sorting is needed here.
  const prefixMatches: Card[] = [];
  const otherMatches: Card[] = [];
  for (const card of sortedCards) {
    if (!matchesAllTokens(card.title, tokens)) {
      continue;
    }
    if (card.title.toLowerCase().startsWith(firstToken)) {
      prefixMatches.push(card);
    } else {
      otherMatches.push(card);
    }
  }
  return prefixMatches.concat(otherMatches);
}

// Everything the setcode search needs, built once per data load. Synthetic set numbers
// aren't searchable.
function buildSearchableSetcodes(
  setcodes: SetCode[],
  cardsById: Map<string, Card>,
): SearchableSetCode[] {
  // Build a map so we don't need to re-lowercase every printing after seeing a card once
  const lowerTitlesByCardId = new Map<string, string>();

  const sortedSetcodes = setcodes
    .filter((setcode) => !setcode.set_number_synthetic)
    .sort((a, b) => setNumberCollator.compare(a.set_number, b.set_number));

  return sortedSetcodes.flatMap((setcode): SearchableSetCode[] => {
    const card = cardsById.get(setcode.card_id);
    if (card === undefined) {
      return [];
    }
    let titleText = lowerTitlesByCardId.get(card.card_id);
    if (titleText === undefined) {
      titleText = card.title.toLowerCase();
      lowerTitlesByCardId.set(card.card_id, titleText);
    }
    return [{ setcode, card, numberText: setcode.set_number.toLowerCase(), titleText }];
  });
}

// Callers pass a non-empty token list and entries already sorted by set number.
function findSetcodeMatches(sortedEntries: SearchableSetCode[], tokens: string[]): SearchableSetCode[] {
  const matches: SearchableSetCode[] = [];
  for (const entry of sortedEntries) {
    if (matchesSetNumberAndTitle(entry.numberText, entry.titleText, tokens)) {
      matches.push(entry);
    }
  }
  return matches;
}

// The regions each card has printings in, across all its setcodes. Built once per data load.
function buildRegionsByCardId(
  setcodes: SetCode[],
  setsById: Map<string, CardSet>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const setcode of setcodes) {
    const set = setsById.get(setcode.set_id);
    if (set === undefined) {
      continue;
    }
    let cardRegions = map.get(setcode.card_id);
    if (cardRegions === undefined) {
      cardRegions = new Set<string>();
      map.set(setcode.card_id, cardRegions);
    }
    cardRegions.add(set.region);
  }
  return map;
}

// How many printings (rarities and so on) each card has across all its setcodes. Built once per data load.
function buildPrintingCountsByCardId(setcodes: SetCode[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const setcode of setcodes) {
    const count = map.get(setcode.card_id) ?? 0;
    map.set(setcode.card_id, count + setcode.printings.length);
  }
  return map;
}

function hasEnabledRegion(cardRegions: Set<string> | undefined, disabledRegions: Set<string>): boolean {
  if (cardRegions === undefined) {
    return false;
  }
  for (const region of cardRegions) {
    if (!disabledRegions.has(region)) {
      return true;
    }
  }
  return false;
}

function ResultsSection({ total, children }: { total: number; children: ReactNode }) {
  return (
    <section>
      <h2>Results ({total})</h2>
      {total > MAX_RESULTS ? (
        <p className="muted">Showing the first {MAX_RESULTS}. Type more to narrow the results.</p>
      ) : null}
      {children}
    </section>
  );
}

function CardSearch({ data }: { data: MasterData }) {
  const { query, disabledGames, disabledRegions, setSearchQuery, setDisabledGames, setDisabledRegions } =
    useFilterParams();
  const tokens = useMemo(() => splitQuery(query), [query]);

  const cardsById = useMemo(() => indexBy(data.cards, (card) => card.card_id), [data]);
  const setsById = useMemo(() => indexBy(data.sets, (set) => set.set_id), [data]);

  // Sorted once per data load, not per keystroke. Copies, so the shared master data isn't reordered.
  const sortedCards = useMemo(
    () => [...data.cards].sort((a, b) => titleCollator.compare(a.title, b.title)),
    [data]
  );

  // Built once per data load, not per keystroke.
  const searchableSetcodes = useMemo(
    () => buildSearchableSetcodes(data.setcodes, cardsById),
    [data, cardsById]
  );

  // Regions and games come from the full unfiltered data, so toggling one off never removes its button.
  const regions = useMemo(() => getRegions(data.sets), [data]);
  const games = useMemo(() => getGames(data.cards), [data]);
  const regionsByCardId = useMemo(() => buildRegionsByCardId(data.setcodes, setsById), [data, setsById]);
  const printingCountsByCardId = useMemo(() => buildPrintingCountsByCardId(data.setcodes), [data]);
  const cardIdsWithUnverifiedPrintings = useMemo(
    () => getCardIdsWithUnverifiedPrintings(data.setcodes),
    [data]
  );

  const cardMatches = useMemo(() => {
    if (tokens.length === 0) {
      return [];
    }
    let matches = findCardMatches(sortedCards, tokens);
    if (disabledGames.size > 0) {
      matches = matches.filter((card) => !disabledGames.has(card.game));
    }
    if (disabledRegions.size > 0) {
      matches = matches.filter((card) => hasEnabledRegion(regionsByCardId.get(card.card_id), disabledRegions));
    }
    return matches;
  }, [sortedCards, tokens, disabledRegions, disabledGames, regionsByCardId]);

  const setcodeMatches = useMemo(() => {
    if (tokens.length === 0) {
      return [];
    }
    let matches = findSetcodeMatches(searchableSetcodes, tokens);
    if (disabledGames.size > 0) {
      // A setcode belongs to its card's game, so it hides along with the card.
      matches = matches.filter(({ card }) => !disabledGames.has(card.game));
    }
    if (disabledRegions.size > 0) {
      matches = matches.filter(({ setcode }) => {
        const set = setsById.get(setcode.set_id);
        return set === undefined || !disabledRegions.has(set.region);
      });
    }
    return matches;
  }, [searchableSetcodes, tokens, disabledRegions, disabledGames, setsById]);

  let results: ReactNode;
  if (games.length > 0 && games.every((game) => disabledGames.has(game))) {
    results = <p className="muted">No games selected.</p>;
  } else if (regions.length > 0 && regions.every((region) => disabledRegions.has(region))) {
    results = <p className="muted">No regions selected.</p>;
  } else if (tokens.length === 0) {
    // TODO show random sample cards when no query entered
    results = null;
  } else if (cardMatches.length === 0 && setcodeMatches.length === 0) {
    results = <p className="muted">No cards or printings match “{query.trim()}”.</p>;
  } else {
    const shownCards = cardMatches.slice(0, MAX_RESULTS);
    const shownSetcodes = setcodeMatches.slice(0, MAX_RESULTS - shownCards.length);
    results = (
      <ResultsSection total={cardMatches.length + setcodeMatches.length}>
        <ul className="tile-grid tile-grid-cards">
          {shownCards.map((card) => (
            <li key={`card-${card.card_id}`}>
              <CardTile
                card={card}
                printingCount={printingCountsByCardId.get(card.card_id) ?? 0}
                hasUnverifiedPrinting={cardIdsWithUnverifiedPrintings.has(card.card_id)}
                backLabel={BACK_LABEL}
              />
            </li>
          ))}
          {shownSetcodes.map(({ setcode, card }) => (
            <li key={`setcode-${setcode.setcode_id}`}>
              <SetCodeTile card={card} setcode={setcode} backLabel={BACK_LABEL} />
            </li>
          ))}
        </ul>
      </ResultsSection>
    );
  }

  return (
    <>
      <SearchBar
        value={query}
        onChange={setSearchQuery}
        placeholder="Search by card name or set number"
        label="Search by card name or set number"
      />
      <GameToggles
        games={games}
        disabledGames={disabledGames}
        onToggle={(game) => setDisabledGames(toggleGame(disabledGames, game))}
      />
      <RegionToggles
        regions={regions}
        disabledRegions={disabledRegions}
        onToggle={(region) => setDisabledRegions(toggleRegion(disabledRegions, region))}
      />
      {results}
    </>
  );
}

export function CardsPage() {
  const { data, error } = useLoadOnMount(loadMasterData);

  let content: ReactNode;
  if (error !== null) {
    content = <p>Couldn't load cards: {error}</p>;
  } else if (data === null) {
    content = <p className="muted">Loading cards…</p>;
  } else {
    content = <CardSearch data={data} />;
  }

  return (
    <>
      <h1>Cards</h1>
      <p className="muted">Search for a card by name, or for a printing by set number.</p>
      {content}
    </>
  );
}