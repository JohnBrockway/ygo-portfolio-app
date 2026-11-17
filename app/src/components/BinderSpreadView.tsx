import type { CSSProperties, ReactNode } from "react";
import { getPlacedCardsOnPage } from "../data/binderPlacements";
import type { BinderCardWithPrinting, PlacedCardsByPageId } from "../data/binderPlacements";
import { MIN_PAGE_COUNT } from "../data/bindersDb";
import type { BinderRecord } from "../data/bindersDb";
import { getPageNumber } from "../data/binderSpreads";
import type { BinderSpread } from "../data/binderSpreads";
import { PlusIcon } from "./ActionIcons";
import { BinderPageGrid } from "./BinderPageGrid";
import { CornerRemoveButton } from "./CornerRemoveButton";

// The two shapes of the button that adds pages.
// - "ghost": the empty right half of a two-page spread that has a single page, as big as a page would be.
// - "strip": narrow and full height, beside the right edge of the last page.
type AddPagesButtonShape = "ghost" | "strip";

function AddPagesButton({
  shape,
  disabled,
  pageCountToAdd,
  onAddPages,
}: {
  shape: AddPagesButtonShape;
  disabled: boolean;
  pageCountToAdd: number;
  onAddPages: (pageCount: number) => void;
}) {
  const label = "Add a page at the end of the binder";

  return (
    <button
      className={`binder-add-pages binder-add-pages-${shape}`}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onAddPages(pageCountToAdd)}
    >
      <PlusIcon />
    </button>
  );
}

// The button on the top right corner of the last page, which removes pages from the end of the binder.
function RemovePagesButton({
  disabled,
  pageCountToRemove,
  onRemovePages,
}: {
  disabled: boolean;
  pageCountToRemove: number;
  onRemovePages: (pageCount: number) => void;
}) {
  const label =
    pageCountToRemove === 1
      ? "Remove the last page of the binder"
      : `Remove the last ${pageCountToRemove} pages of the binder`;

  return <CornerRemoveButton label={label} disabled={disabled} onClick={() => onRemovePages(pageCountToRemove)} />;
}

// Which side of its page the page's number is on.
type PageNumberSide = "left" | "right";

// The number of a page is on the outer side of it, at the bottom, like in a printed book: in a two-page layout a left page
// has it on its left and a right page on its right. The binder's first page is alone on the right of the opening spread,
// and any other page that is alone is the last one, on the left. In the one-page layout it is always on the left.
function getPageNumberSide(twoPageLayout: boolean, isFirstSpread: boolean, indexInSpread: number): PageNumberSide {
  if (!twoPageLayout) {
    return "left";
  }
  if (isFirstSpread || indexInSpread === 1) {
    return "right";
  }
  return "left";
}

// One page, with its number beside the bottom corner, and the narrow add pages strip beside it and the remove pages
// button on its corner if it is asked to have them.
function BinderPageFrame({
  binder,
  pageId,
  pageNumberSide,
  placedCardsByPageId,
  selectedCard,
  slotChangesDisabled,
  hasAddPagesStrip,
  hasRemovePagesButton,
  addPagesDisabled,
  removePagesDisabled,
  pageCountToRemove,
  onSlotClick,
  onAddPages,
  onRemovePages,
}: {
  binder: BinderRecord;
  pageId: string;
  pageNumberSide: PageNumberSide;
  placedCardsByPageId: PlacedCardsByPageId;
  selectedCard: BinderCardWithPrinting | null;
  slotChangesDisabled: boolean;
  hasAddPagesStrip: boolean;
  hasRemovePagesButton: boolean;
  addPagesDisabled: boolean;
  removePagesDisabled: boolean;
  pageCountToRemove: number;
  onSlotClick: (pageId: string, slotIndex: number) => void;
  onAddPages: (pageCount: number) => void;
  onRemovePages: (pageCount: number) => void;
}) {
  const pageNumber = getPageNumber(binder.pageIds, pageId);

  // The strip is on the right of the page, in the room where a number on the right would go, so that number moves out past
  // the strip.
  let pageNumberClass = `muted binder-page-number binder-page-number-${pageNumberSide}`;
  if (pageNumberSide === "right" && hasAddPagesStrip) {
    pageNumberClass += " binder-page-number-past-strip";
  }

  let addPagesStrip: ReactNode = null;
  if (hasAddPagesStrip) {
    addPagesStrip = <AddPagesButton shape="strip" disabled={addPagesDisabled} pageCountToAdd={1} onAddPages={onAddPages} />;
  }

  let removePagesButton: ReactNode = null;
  if (hasRemovePagesButton) {
    removePagesButton = (
      <RemovePagesButton
        disabled={removePagesDisabled}
        pageCountToRemove={pageCountToRemove}
        onRemovePages={onRemovePages}
      />
    );
  }

  return (
    <div className="binder-page-frame">
      <BinderPageGrid
        columns={binder.columns}
        rows={binder.rows}
        pageNumber={pageNumber}
        placedCards={getPlacedCardsOnPage(placedCardsByPageId, pageId)}
        selectedCard={selectedCard}
        slotChangesDisabled={slotChangesDisabled}
        onSlotClick={(slotIndex) => onSlotClick(pageId, slotIndex)}
      />
      <span className={pageNumberClass} aria-hidden="true">
        {pageNumber}
      </span>
      {addPagesStrip}
      {removePagesButton}
    </div>
  );
}

// A representation of an open binder, meaning it may hold one page and one empty space
// (if it's the first or last page), or two pages. Each page shows the cards placed in its slots; what a tap on a slot
// does is up to the caller (onSlotClick). The previous and next buttons beside the spread are the caller's too.
//
// The pages are sized to fit the height of the pane the spread is in, as well as its width (see .binder-spread in
// index.css, which is why the binder's columns and rows are set as custom properties on the spread).
//
// Pages are only added and removed at the end of the binder, so the buttons for that are on the last page, and only there
// while that page is open. In a two-page layout, when the last page is on its own on the left, the empty half of the
// spread is where the next page would go, so the add button fills it as a page-sized ghost that adds 2 pages, like a
// physical binder sheet. Otherwise (the one-page layout, or a last spread that is full) it is a strip beside the page,
// adding one. The remove button, in the corner of the last page, is disabled when that would leave fewer than MIN_PAGE_COUNT pages.
//
// Two flags say what is not possible right now: pageChangesDisabled for adding and removing pages (it also covers a page
// change that is still being saved), slotChangesDisabled for changing the cards in the slots.
export function BinderSpreadView({
  binder,
  spread,
  twoPageLayout,
  isFirstSpread,
  placedCardsByPageId,
  selectedCard,
  slotChangesDisabled,
  pageChangesDisabled,
  onSlotClick,
  onAddPages,
  onRemovePages,
}: {
  binder: BinderRecord;
  spread: BinderSpread;
  twoPageLayout: boolean;
  isFirstSpread: boolean;
  placedCardsByPageId: PlacedCardsByPageId;
  selectedCard: BinderCardWithPrinting | null;
  slotChangesDisabled: boolean;
  pageChangesDisabled: boolean;
  onSlotClick: (pageId: string, slotIndex: number) => void;
  onAddPages: (pageCount: number) => void;
  onRemovePages: (pageCount: number) => void;
}) {
  // In a two-page layout the first spread is the one with the binder's first page alone on the right, so a single page
  // on any other spread is the last page, on the left.
  const endIsGhost = twoPageLayout && !isFirstSpread && spread.length === 1;

  let addPagesGhost: ReactNode = null;
  if (endIsGhost) {
    addPagesGhost = <AddPagesButton shape="ghost" disabled={pageChangesDisabled} pageCountToAdd={2} onAddPages={onAddPages} />;
  }

  // Change here if we want to allow multi-page removal, representative of taking a physical sheet out of a binder
  const pageCountToRemove = 1;
  const removePagesDisabled = pageChangesDisabled || binder.pageIds.length - pageCountToRemove < MIN_PAGE_COUNT;

  let spreadClass = "binder-spread";
  if (twoPageLayout) {
    spreadClass += " binder-spread-two";
    if (isFirstSpread) {
      spreadClass += " binder-spread-opening";
    }
  }

  // What the CSS needs to size the pages from the height they have (a custom property isn't part of CSSProperties).
  const spreadStyle = {
    "--binder-columns": binder.columns,
    "--binder-rows": binder.rows,
  } as CSSProperties;

  const lastPageId = binder.pageIds[binder.pageIds.length - 1];
  const pageIds: readonly string[] = spread;

  return (
    <div className={spreadClass} style={spreadStyle}>
      {pageIds.map((pageId, indexInSpread) => (
        <BinderPageFrame
          key={pageId}
          binder={binder}
          pageId={pageId}
          pageNumberSide={getPageNumberSide(twoPageLayout, isFirstSpread, indexInSpread)}
          placedCardsByPageId={placedCardsByPageId}
          selectedCard={selectedCard}
          slotChangesDisabled={slotChangesDisabled}
          hasAddPagesStrip={pageId === lastPageId && !endIsGhost}
          hasRemovePagesButton={pageId === lastPageId}
          addPagesDisabled={pageChangesDisabled}
          removePagesDisabled={removePagesDisabled}
          pageCountToRemove={pageCountToRemove}
          onSlotClick={onSlotClick}
          onAddPages={onAddPages}
          onRemovePages={onRemovePages}
        />
      ))}
      {addPagesGhost}
    </div>
  );
}