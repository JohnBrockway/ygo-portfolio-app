import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { loadSets } from "../data/loadSets";
import type { CardSet } from "../data/types";

function formatPrintingCount(count: number): string {
  return count === 1 ? "1 card" : `${count} cards`;
}

export function SetsPage() {
  const [sets, setSets] = useState<CardSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore the result if the page was left before the fetch finished.
    let cancelled = false;

    loadSets()
      .then((loadedSets) => {
        if (!cancelled) {
          setSets(loadedSets);
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
    content = <p>Couldn't load sets: {error}</p>;
  } else if (sets === null) {
    content = <p className="muted">Loading sets…</p>;
  } else if (sets.length === 0) {
    content = <p className="muted">No sets found.</p>;
  } else {
    content = (
      <ul className="set-list">
        {sets.map((set) => (
          <li key={set.set_id} className="set-row">
            <div className="set-title">{set.title}</div>
            <div className="set-meta">
              <span className="tag">{set.region.toUpperCase()}</span>
              <span>{set.release_date.text}</span>
              <span>{formatPrintingCount(set.printing_count)}</span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <h1>Sets</h1>
      <p className="muted">Browse sets and open one to see its printings.</p>
      {content}
    </>
  );
}