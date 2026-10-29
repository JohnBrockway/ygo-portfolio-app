import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { RegionToggles } from "../components/RegionToggles";
import { SearchBar } from "../components/SearchBar";
import { loadMasterData } from "../data/masterData";
import { getRegions, toggleRegion } from "../data/regions";
import { matchesAllTokens, splitQuery } from "../data/search";
import type { Card, MasterData } from "../data/types";

type SetRecord = MasterData["sets"][number];
type PrintingRecord = MasterData["printings"][number];

// Keeps the DOM small; the heading shows the full match count.
const MAX_RESULTS_PER_SECTION = 50;

// Shared collators: calling localeCompare with options builds a new collator on every call,
// which is far slower than reusing one. numeric: true sorts "LOB-EN013" before "LOB-EN072".
const titleCollator = new Intl.Collator();
const setNumberCollator = new Intl.Collator(undefined, { numeric: true });

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

// Callers pass printings already sorted by set number, with synthetic numbers removed.
function findPrintingMatches(sortedPrintings: PrintingRecord[], tokens: string[]): PrintingRecord[] {
  const matches: PrintingRecord[] = [];
  for (const printing of sortedPrintings) {
    if (matchesAllTokens(printing.set_number, tokens)) {
      matches.push(printing);
    }
  }
  return matches;
}

// The full list of regions any visible result has printings in. Built once per data load.
function buildRegionsByCardId(
  printings: PrintingRecord[],
  setsById: Map<string, SetRecord>
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const printing of printings) {
    const set = setsById.get(printing.set_id);
    if (set === undefined) {
      continue;
    }
    let cardRegions = map.get(printing.card_id);
    if (cardRegions === undefined) {
      cardRegions = new Set<string>();
      map.set(printing.card_id, cardRegions);
    }
    cardRegions.add(set.region);
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

function CardRow({ card }: { card: Card }) {
  return (
    <li>
      <Link to={`/cards/${card.card_id}`} className="row">
        <div className="row-title">{card.title}</div>
        <div className="row-meta">{card.card_type ? <span className="tag">{card.card_type}</span> : null}</div>
      </Link>
    </li>
  );
}

function PrintingRow({
  printing,
  cardsById,
  setsById,
}: {
  printing: PrintingRecord;
  cardsById: Map<string, Card>;
  setsById: Map<string, SetRecord>;
}) {
  const card = cardsById.get(printing.card_id);
  const set = setsById.get(printing.set_id);
  const cardName = card === undefined ? printing.card_id : card.title;
  const setTitle = set === undefined ? printing.set_id : set.title;

  return (
    <li>
      <Link to={`/printings/${printing.printing_id}`} className="row">
        <div className="row-title">{cardName}</div>
        <div className="row-meta">
          {set === undefined ? null : <span className="tag">{set.region}</span>}
          {printing.set_number_synthetic ? null : <span>{printing.set_number}</span>}
          <span className="tag">{printing.rarity}</span>
          <span>{setTitle}</span>
        </div>
      </Link>
    </li>
  );
}

function ResultSection({ title, total, children }: { title: string; total: number; children: ReactNode }) {
  return (
    <section>
      <h2>
        {title} ({total})
      </h2>
      {total > MAX_RESULTS_PER_SECTION ? (
        <p className="muted">Showing the first {MAX_RESULTS_PER_SECTION}. Type more to narrow the results.</p>
      ) : null}
      {children}
    </section>
  );
}

function CardSearch({ data }: { data: MasterData }) {
  const [query, setQuery] = useState("");
  const [disabledRegions, setDisabledRegions] = useState<Set<string>>(() => new Set());
  const tokens = useMemo(() => splitQuery(query), [query]);

  const cardsById = useMemo(() => {
    const map = new Map<string, Card>();
    for (const card of data.cards) {
      map.set(card.card_id, card);
    }
    return map;
  }, [data]);

  const setsById = useMemo(() => {
    const map = new Map<string, SetRecord>();
    for (const set of data.sets) {
      map.set(set.set_id, set);
    }
    return map;
  }, [data]);

  // Sorted once per data load, not per keystroke. Copies, so the shared master data isn't reordered.
  const sortedCards = useMemo(
    () => [...data.cards].sort((a, b) => titleCollator.compare(a.title, b.title)),
    [data]
  );

  // Synthetic set numbers are never shown, so they must not be searchable either.
  const searchablePrintings = useMemo(
    () =>
      data.printings
        .filter((printing) => !printing.set_number_synthetic)
        .sort((a, b) => setNumberCollator.compare(a.set_number, b.set_number)),
    [data]
  );

  // Regions come from the full unfiltered data, so toggling one off never removes its button.
  const regions = useMemo(() => getRegions(data.sets), [data]);
  const regionsByCardId = useMemo(() => buildRegionsByCardId(data.printings, setsById), [data, setsById]);

  const cardMatches = useMemo(() => {
    if (tokens.length === 0) {
      return [];
    }
    const matches = findCardMatches(sortedCards, tokens);
    if (disabledRegions.size === 0) {
      return matches;
    }
    return matches.filter((card) => hasEnabledRegion(regionsByCardId.get(card.card_id), disabledRegions));
  }, [sortedCards, tokens, disabledRegions, regionsByCardId]);

  const printingMatches = useMemo(() => {
    if (tokens.length === 0) {
      return [];
    }
    const matches = findPrintingMatches(searchablePrintings, tokens);
    if (disabledRegions.size === 0) {
      return matches;
    }
    return matches.filter((printing) => {
      const set = setsById.get(printing.set_id);
      return set === undefined || !disabledRegions.has(set.region);
    });
  }, [searchablePrintings, tokens, disabledRegions, setsById]);

  let results: ReactNode;
  if (regions.length > 0 && regions.every((region) => disabledRegions.has(region))) {
    results = <p className="muted">No regions selected.</p>;
  } else if (tokens.length === 0) {
    // TODO show random sample cards when no query entered
  } else if (cardMatches.length === 0 && printingMatches.length === 0) {
    results = <p className="muted">No cards or printings match “{query.trim()}”.</p>;
  } else {
    results = (
      <>
        {cardMatches.length > 0 ? (
          <ResultSection title="Cards" total={cardMatches.length}>
            <ul className="row-list">
              {cardMatches.slice(0, MAX_RESULTS_PER_SECTION).map((card) => (
                <CardRow key={card.card_id} card={card} />
              ))}
            </ul>
          </ResultSection>
        ) : null}
        {printingMatches.length > 0 ? (
          <ResultSection title="Printings" total={printingMatches.length}>
            <ul className="row-list">
              {printingMatches.slice(0, MAX_RESULTS_PER_SECTION).map((printing) => (
                <PrintingRow
                  key={printing.printing_id}
                  printing={printing}
                  cardsById={cardsById}
                  setsById={setsById}
                />
              ))}
            </ul>
          </ResultSection>
        ) : null}
      </>
    );
  }

  return (
    <>
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search by card name or set number"
        label="Search by card name or set number"
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
  const [data, setData] = useState<MasterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore the result if the page was left before the fetch finished.
    let cancelled = false;

    loadMasterData()
      .then((loadedData) => {
        if (!cancelled) {
          setData(loadedData);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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