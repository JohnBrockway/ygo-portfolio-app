import { useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { BinderMeta } from "../components/BinderMeta";
import { BinderSpreadView } from "../components/BinderSpreadView";
import { addPageToBinder, canChangeBinders, getBinderCards, getBinders, useLiveBinders } from "../data/binders";
import type { BinderRecord } from "../data/bindersDb";
import { findSpreadIndex, getBinderSpreads, getPageNumber } from "../data/binderSpreads";
import type { BinderSpread } from "../data/binderSpreads";
import { useLiveMediaQuery } from "../data/useLiveMediaQuery";

// From this screen width two pages fit side by side; below it the binder is shown a page at a time.
const TWO_PAGE_LAYOUT_QUERY = "(min-width: 1000px)";

// Which pages are open, e.g. "Pages 2–3 of 4".
function describeSpread(binder: BinderRecord, spread: BinderSpread): string {
  const firstPageNumber = getPageNumber(binder.pageIds, spread[0]);
  const pageCount = binder.pageIds.length;
  if (spread.length === 2) {
    return `Pages ${firstPageNumber}–${firstPageNumber + 1} of ${pageCount}`;
  }
  return `Page ${firstPageNumber} of ${pageCount}`;
}

function BinderContents({ binder, changesDisabled }: { binder: BinderRecord; changesDisabled: boolean }) {
  const twoPageLayout = useLiveMediaQuery(TWO_PAGE_LAYOUT_QUERY);
  // A page that is open, not a position: so the same page stays open when the screen changes between one and two pages
  // at a time, or when pages are added. null until the user has flipped to somewhere, which is the first page.
  const [viewedPageId, setViewedPageId] = useState<string | null>(null);
  const [addingPages, setAddingPages] = useState(false);

  const spreads = getBinderSpreads(binder.pageIds, twoPageLayout);
  const spreadIndex = findSpreadIndex(spreads, viewedPageId);
  const spread = spreads[spreadIndex];
  if (spread === undefined) {
    // A binder always has at least one page, so this is a mistake somewhere else.
    throw new Error(`Binder "${binder.id}" has no pages`);
  }
  // Reading past either end of an array gives undefined (it doesn't throw; index -1 is just a missing entry), so these
  // are undefined on the first and the last spread. Don't use .at() here: .at(-1) wraps around to the last entry.
  const previousSpread = spreads[spreadIndex - 1];
  const nextSpread = spreads[spreadIndex + 1];

  function showSpread(target: BinderSpread | undefined) {
    // The buttons that call this are disabled when there is nothing to show.
    if (target === undefined) {
      return;
    }
    setViewedPageId(target[0]);
  }

  // Adds pages one at a time (that is all the data layer does), stopping at the first that doesn't save. Pages that
  // were already added stay.
  async function handleAddPages(pageCount: number) {
    setAddingPages(true);
    let allSaved = true;
    for (let added = 0; added < pageCount; added++) {
      const result = await addPageToBinder(binder.id);
      if (result.status !== "saved") {
        allSaved = false;
        break;
      }
    }
    setAddingPages(false);
    if (!allSaved) {
      // The banner explains.
      return;
    }

    // Show the end of the binder: the last page added is now its last page, as memory holds it.
    const savedBinder = getBinders().activeBinders.find((candidate) => candidate.id === binder.id);
    if (savedBinder === undefined) {
      // Deleted in another tab in the meantime; the page then shows "not found".
      return;
    }
    const newPageId = savedBinder.pageIds[savedBinder.pageIds.length - 1];
    if (newPageId !== undefined) {
      setViewedPageId(newPageId);
    }
  }

  return (
    <>
      <BinderSpreadView
        binder={binder}
        spread={spread}
        twoPageLayout={twoPageLayout}
        isFirstSpread={spreadIndex === 0}
        addPagesDisabled={changesDisabled || addingPages}
        onAddPages={handleAddPages}
      />
      <div className="binder-nav">
        <button
          className="action-button"
          type="button"
          disabled={previousSpread === undefined}
          onClick={() => showSpread(previousSpread)}
        >
          Previous
        </button>
        <span className="muted">{describeSpread(binder, spread)}</span>
        <button
          className="action-button"
          type="button"
          disabled={nextSpread === undefined}
          onClick={() => showSpread(nextSpread)}
        >
          Next
        </button>
      </div>
    </>
  );
}

export function BinderDetailPage() {
  const { binderId } = useParams();
  const bindersState = useLiveBinders();

  const binder = bindersState.activeBinders.find((candidate) => candidate.id === binderId);
  const changesDisabled = !canChangeBinders(bindersState);

  let content: ReactNode;
  if (bindersState.status === "loading") {
    content = <p className="muted">Loading binder…</p>;
  } else if (binder === undefined) {
    // Also what shows when the binder was deleted in another tab, or after a failed load (the banner says why).
    content = (
      <>
        <h1>Binder not found</h1>
        <p className="muted">No binder matches this address.</p>
      </>
    );
  } else {
    content = (
      <>
        <h1>{binder.name}</h1>
        <BinderMeta binder={binder} cards={getBinderCards(bindersState, binder.id)} />
        {/* The key starts the page view over (back at the first page) when the address changes to another binder. */}
        <BinderContents key={binder.id} binder={binder} changesDisabled={changesDisabled} />
      </>
    );
  }

  return (
    <>
      <p>
        <BackLink fallbackTo="/binders" fallbackLabel="Binders" />
      </p>
      {content}
    </>
  );
}