// What is open at once when looking at a binder: one page or two side by side. Pages are identified by id (see
// BinderRecord.pageIds), so a spread stays the same thing when pages are added to the binder.
export type BinderSpread = readonly [string] | readonly [string, string];

// Groups the binder's pages (in binder order) into spreads.
// - With twoPageLayout, the way a real binder opens: the first page is on its own, the rest are paired from the second
//   page on, and a page left over at the end is on its own again. (An odd number of pages therefore has no single page at
//   the end.)
// - Without it, every page is a spread of its own.
// Returns no spreads for no pages.
export function getBinderSpreads(pageIds: readonly string[], twoPageLayout: boolean): BinderSpread[] {
  const spreads: BinderSpread[] = [];
  let pendingPageId: string | null = null;

  for (const [index, pageId] of pageIds.entries()) {
    if (!twoPageLayout || index === 0) {
      spreads.push([pageId]);
    } else if (pendingPageId === null) {
      pendingPageId = pageId;
    } else {
      spreads.push([pendingPageId, pageId]);
      pendingPageId = null;
    }
  }
  if (pendingPageId !== null) {
    spreads.push([pendingPageId]);
  }

  return spreads;
}

// The number of a page as the user sees it: its position in the binder, counting from 1. A page that isn't in the binder
// is a mistake in the caller, so it throws.
export function getPageNumber(pageIds: readonly string[], pageId: string): number {
  const index = pageIds.indexOf(pageId);
  if (index === -1) {
    throw new Error(`Page "${pageId}" isn't in this binder`);
  }
  return index + 1;
}

// The position of the spread that has the page in it, or of the first spread when no page is given (or none of them
// has it, which happens when the page is gone).
export function findSpreadIndex(spreads: readonly BinderSpread[], pageId: string | null): number {
  const index = spreads.findIndex((spread) => pageId !== null && spread.includes(pageId));
  return index === -1 ? 0 : index;
}