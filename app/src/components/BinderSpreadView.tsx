import type { ReactNode } from "react";
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
  pageCountToAdd: number
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

// One page, with the narrow add pages strip beside it and the remove pages button on its corner if it is asked to have
// them.
function BinderPageFrame({
  binder,
  pageId,
  hasAddPagesStrip,
  hasRemovePagesButton,
  addPagesDisabled,
  removePagesDisabled,
  pageCountToRemove,
  onAddPages,
  onRemovePages,
}: {
  binder: BinderRecord;
  pageId: string;
  hasAddPagesStrip: boolean;
  hasRemovePagesButton: boolean;
  addPagesDisabled: boolean;
  removePagesDisabled: boolean;
  pageCountToRemove: number;
  onAddPages: (pageCount: number) => void;
  onRemovePages: (pageCount: number) => void;
}) {
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
        pageNumber={getPageNumber(binder.pageIds, pageId)}
      />
      {addPagesStrip}
      {removePagesButton}
    </div>
  );
}

// A representation of an open binder, meaning it may hold one page and one empty space
// (if it's the first or last page), or two pages
//
// Pages are only added and removed at the end of the binder, so the buttons for that are on the last page, and only there
// while that page is open. In a two-page layout, when the last page is on its own on the left, the empty half of the
// spread is where the next page would go, so the add button fills it as a page-sized ghost that adds 2 pages, like a
// physical binder sheet. Otherwise (the one-page layout, or a last spread that is full) it is a strip beside the page,
// adding one. The remove button, in the corner of the last page, is disabled when that would leave fewer than MIN_PAGE_COUNT pages.
export function BinderSpreadView({
  binder,
  spread,
  twoPageLayout,
  isFirstSpread,
  pageChangesDisabled,
  onAddPages,
  onRemovePages,
}: {
  binder: BinderRecord;
  spread: BinderSpread;
  twoPageLayout: boolean;
  isFirstSpread: boolean;
  pageChangesDisabled: boolean;
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

  const lastPageId = binder.pageIds[binder.pageIds.length - 1];
  const pageIds: readonly string[] = spread;

  return (
    <div className={spreadClass}>
      {pageIds.map((pageId) => (
        <BinderPageFrame
          key={pageId}
          binder={binder}
          pageId={pageId}
          hasAddPagesStrip={pageId === lastPageId && !endIsGhost}
          hasRemovePagesButton={pageId === lastPageId}
          addPagesDisabled={pageChangesDisabled}
          removePagesDisabled={removePagesDisabled}
          pageCountToRemove={pageCountToRemove}
          onAddPages={onAddPages}
          onRemovePages={onRemovePages}
        />
      ))}
      {addPagesGhost}
    </div>
  );
}