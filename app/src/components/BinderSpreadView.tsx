import type { ReactNode } from "react";
import type { BinderRecord } from "../data/bindersDb";
import { getPageNumber } from "../data/binderSpreads";
import type { BinderSpread } from "../data/binderSpreads";
import { PlusIcon } from "./ActionIcons";
import { BinderPageGrid } from "./BinderPageGrid";

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

// One page, with the narrow add pages strip beside it if it is asked to have one.
function BinderPageFrame({
  binder,
  pageId,
  hasAddPagesStrip,
  addPagesDisabled,
  onAddPages,
}: {
  binder: BinderRecord;
  pageId: string;
  hasAddPagesStrip: boolean;
  addPagesDisabled: boolean;
  onAddPages: (pageCount: number) => void;
}) {
  let addPagesStrip: ReactNode = null;
  if (hasAddPagesStrip) {
    addPagesStrip = <AddPagesButton shape="strip" disabled={addPagesDisabled} pageCountToAdd={1} onAddPages={onAddPages} />;
  }

  return (
    <div className="binder-page-frame">
      <BinderPageGrid
        columns={binder.columns}
        rows={binder.rows}
        pageNumber={getPageNumber(binder.pageIds, pageId)}
      />
      {addPagesStrip}
    </div>
  );
}

// A representation of an open binder, meaning it may hold one page and one empty space
// (if it's the first or last page), or two pages
//
// Pages are only added at the end of the binder, so the button that adds them is next to the last page, and only there
// while that page is open. In a two-page layout, when the last page is on its own on the left, the empty half of the
// spread is where the next page would go, so the button fills it as a page-sized ghost that adds 2 pages, like a
// physical binder sheet. Otherwise (the one-page layout, or a last spread that is full) it is a strip beside the page,
// adding one.
export function BinderSpreadView({
  binder,
  spread,
  twoPageLayout,
  isFirstSpread,
  addPagesDisabled,
  onAddPages,
}: {
  binder: BinderRecord;
  spread: BinderSpread;
  twoPageLayout: boolean;
  isFirstSpread: boolean;
  addPagesDisabled: boolean;
  onAddPages: (pageCount: number) => void;
}) {
  // In a two-page layout the first spread is the one with the binder's first page alone on the right, so a single page
  // on any other spread is the last page, on the left.
  const endIsGhost = twoPageLayout && !isFirstSpread && spread.length === 1;

  let addPagesGhost: ReactNode = null;
  if (endIsGhost) {
    addPagesGhost = <AddPagesButton shape="ghost" disabled={addPagesDisabled} pageCountToAdd={2} onAddPages={onAddPages} />;
  }

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
          addPagesDisabled={addPagesDisabled}
          onAddPages={onAddPages}
        />
      ))}
      {addPagesGhost}
    </div>
  );
}