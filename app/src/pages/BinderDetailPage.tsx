import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { BinderPool } from "../components/BinderPool";
import { BinderSpreadView } from "../components/BinderSpreadView";
import { getPlacedCardsOnPage, groupPlacedCardsByPage } from "../data/binderPlacements";
import {
  addPageToBinder,
  canChangeBinders,
  getBinderCards,
  getBinders,
  placeCardInSlot,
  removeLastPageFromBinder,
  useLiveBinders,
} from "../data/binders";
import type { BinderCardRecord, BinderRecord, BinderSaveResult } from "../data/bindersDb";
import { findSpreadIndex, getBinderSpreads, getPageNumber } from "../data/binderSpreads";
import type { BinderSpread } from "../data/binderSpreads";
import { formatCount } from "../data/formatCount";
import { buildFoundPrintingsById, joinRecordsWithMasterData } from "../data/foundPrintings";
import { loadMasterData } from "../data/masterData";
import type { MasterData } from "../data/types";
import { useLiveMediaQuery } from "../data/useLiveMediaQuery";
import { useLoadOnMount } from "../data/useLoadOnMount";

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

function BinderContents({
  binder,
  cards,
  data,
  changesDisabled,
}: {
  binder: BinderRecord;
  cards: readonly BinderCardRecord[];
  data: MasterData;
  changesDisabled: boolean;
}) {
  const twoPageLayout = useLiveMediaQuery(TWO_PAGE_LAYOUT_QUERY);
  // A page that is open, not a position: so the same page stays open when the screen changes between one and two pages
  // at a time, or when pages are added or removed. null until the user has flipped to somewhere, which is the first
  // page.
  const [viewedPageId, setViewedPageId] = useState<string | null>(null);
  const [changingPages, setChangingPages] = useState(false);
  // The card that is picked up, by id: tapped in the pool or in a slot, and meant to be put in a slot next. null while
  // nothing is picked up. What counts is the card that has this id now (see selectedCard), so an id of a card that has
  // gone (removed here, or in another tab) is the same as no selection.
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  // Built once per data load, not per change to the binder.
  const foundPrintingsById = useMemo(() => buildFoundPrintingsById(data), [data]);
  // Both panes need the cards with their printings: the pool shows all of them, the pages the ones in slots.
  const cardTiles = useMemo(() => joinRecordsWithMasterData(cards, foundPrintingsById), [cards, foundPrintingsById]);
  const placedCardsByPageId = useMemo(() => groupPlacedCardsByPage(cardTiles), [cardTiles]);
  const selectedCard = cardTiles.find((tile) => tile.record.id === selectedCardId) ?? null;

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

  // Changes pages one at a time (that is all the data layer does), stopping at the first change that doesn't save. Pages
  // that were already changed stay. Resolves with whether every change saved.
  async function changePagesOneByOne(
    pageCount: number,
    changeOnePage: () => Promise<BinderSaveResult>,
  ): Promise<boolean> {
    setChangingPages(true);
    let allSaved = true;
    for (let changed = 0; changed < pageCount; changed++) {
      const result = await changeOnePage();
      if (result.status !== "saved") {
        allSaved = false;
        break;
      }
    }
    setChangingPages(false);
    return allSaved;
  }

  async function handleAddPages(pageCount: number) {
    const allSaved = await changePagesOneByOne(pageCount, () => addPageToBinder(binder.id));
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

  async function handleRemovePages(pageCount: number) {
    // The page that is the last one once the pages are gone. It is shown first, so the view is never on a page that no
    // longer exists.
    const newLastPageId = binder.pageIds[binder.pageIds.length - 1 - pageCount];
    if (newLastPageId === undefined) {
      // The remove button should have been disabled here, so this is a mistake somewhere else.
      throw new Error(`Binder "${binder.id}" doesn't have ${pageCount} pages to remove`);
    }
    setViewedPageId(newLastPageId);

    await changePagesOneByOne(pageCount, () => removeLastPageFromBinder(binder.id));
  }

  // Tapping a pool card picks that card up; tapping the picked up card again puts it down.
  function handleToggleCardSelection(cardId: string) {
    setSelectedCardId(cardId === selectedCardId ? null : cardId);
  }

  function handleClearSelection() {
    setSelectedCardId(null);
  }

  // What a tap on a slot does (the page grid only offers the taps that do something):
  // - nothing is picked up: picks up the card in the slot;
  // - the slot holds the picked up card: puts it down;
  // - otherwise: puts the picked up card in the slot. A card that was in the slot changes places with it, or goes back to
  //   the pool if the picked up card came from the pool (see placeCardInSlot).
  async function handleSlotClick(pageId: string, slotIndex: number) {
    const cardInSlot = getPlacedCardsOnPage(placedCardsByPageId, pageId).get(slotIndex);

    if (selectedCard === null) {
      if (cardInSlot !== undefined) {
        setSelectedCardId(cardInSlot.record.id);
      }
      return;
    }
    if (cardInSlot !== undefined && cardInSlot.record.id === selectedCard.record.id) {
      setSelectedCardId(null);
      return;
    }

    const result = await placeCardInSlot(selectedCard.record.id, { pageId, slotIndex });
    // After a failure the card stays picked up, and the banner explains.
    if (result.status === "saved") {
      setSelectedCardId(null);
    }
  }

  // The pages and the pool panes are both direct children of .binder-detail, which splits the
  // room under the title between them (see index.css). The nav stays in view under the pages while the pages scroll.
  return (
    <>
      <div className="binder-pages-pane">
        <div className="binder-pages-scroll">
          <BinderSpreadView
            binder={binder}
            spread={spread}
            twoPageLayout={twoPageLayout}
            isFirstSpread={spreadIndex === 0}
            placedCardsByPageId={placedCardsByPageId}
            selectedCard={selectedCard}
            slotChangesDisabled={changesDisabled}
            pageChangesDisabled={changesDisabled || changingPages}
            onSlotClick={handleSlotClick}
            onAddPages={handleAddPages}
            onRemovePages={handleRemovePages}
          />
        </div>
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
      </div>
      <BinderPool
        binder={binder}
        cardTiles={cardTiles}
        selectedCard={selectedCard}
        changesDisabled={changesDisabled}
        onToggleCardSelection={handleToggleCardSelection}
        onClearSelection={handleClearSelection}
      />
    </>
  );
}

export function BinderDetailPage() {
  const { binderId } = useParams();
  const bindersState = useLiveBinders();
  const { data, error } = useLoadOnMount(loadMasterData);

  const binder = bindersState.activeBinders.find((candidate) => candidate.id === binderId);
  const changesDisabled = !canChangeBinders(bindersState);

  let content: ReactNode;
  if (error !== null) {
    content = <p>Couldn't load binder contents: {error}</p>;
  } else if (data === null || bindersState.status === "loading") {
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
    const cards = getBinderCards(bindersState, binder.id);
    content = (
      <>
        <h1>
          {binder.name}
          <span className="muted binder-title-count"> · {formatCount(cards.length, "card", "cards")} in binder</span>
        </h1>
        {/* The key starts the page view over (back at the first page, nothing picked up) when the address changes to another binder. */}
        <BinderContents key={binder.id} binder={binder} cards={cards} data={data} changesDisabled={changesDisabled} />
      </>
    );
  }

  return (
    <div className="binder-detail">
      <p>
        <BackLink fallbackTo="/binders" fallbackLabel="Binders" />
      </p>
      {content}
    </div>
  );
}