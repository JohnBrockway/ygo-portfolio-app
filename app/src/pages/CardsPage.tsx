import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SearchBar } from "../components/SearchBar";
import { loadMasterData } from "../data/masterData";
import { matchesAllTokens, splitQuery } from "../data/search";
import type { Card, MasterData } from "../data/types";

type SetRecord = MasterData["sets"][number];
type PrintingRecord = MasterData["printings"][number];

// Keeps the DOM small; the heading shows the full match count.
const MAX_RESULTS_PER_SECTION = 50;

// Callers pass a non-empty token list.
function findCardMatches(cards: Card[], tokens: string[]): Card[] {
  const firstToken = tokens[0].toLowerCase();

  const matches: Card[] = [];
  for (const card of cards) {
    if (matchesAllTokens(card.title, tokens)) {
      matches.push(card);
    }
  }

  // Titles that start with the first token come first, then alphabetical.
  matches.sort((a, b) => {
    const aStarts = a.title.toLowerCase().startsWith(firstToken);
    const bStarts = b.title.toLowerCase().startsWith(firstToken);
    if (aStarts !== bStarts) {
      return aStarts ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
  return matches;
}

function findPrintingMatches(printings: PrintingRecord[], tokens: string[]): PrintingRecord[] {
  const matches: PrintingRecord[] = [];
  for (const printing of printings) {
    // Synthetic set numbers are never shown, so they must not be searchable either.
    if (printing.set_number_synthetic) {
      continue;
    }
    if (matchesAllTokens(printing.set_number, tokens)) {
      matches.push(printing);
    }
  }

  // numeric: true sorts "LOB-EN013" before "LOB-EN072".
  matches.sort((a, b) => a.set_number.localeCompare(b.set_number, undefined, { numeric: true }));
  return matches;
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
    <li className="row">
      <div className="row-title">{cardName}</div>
      <div className="row-meta">
        {set === undefined ? null : <span className="tag">{set.region}</span>}
        {printing.set_number_synthetic ? null : <span>{printing.set_number}</span>}
        <span className="tag">{printing.rarity}</span>
        {set === undefined ? <span>{setTitle}</span> : <Link to={`/sets/${set.set_id}`}>{setTitle}</Link>}
      </div>
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

  const cardMatches = useMemo(() => {
    if (tokens.length === 0) {
      return [];
    }
    return findCardMatches(data.cards, tokens);
  }, [data, tokens]);

  const printingMatches = useMemo(() => {
    if (tokens.length === 0) {
      return [];
    }
    return findPrintingMatches(data.printings, tokens);
  }, [data, tokens]);

  let results: ReactNode;
  if (tokens.length === 0) {
    results = <p className="muted">Type a card name or set number to search.</p>;
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