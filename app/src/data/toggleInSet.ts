// Returns a new set with the item removed if it was in the set, or added if it wasn't (React state must not be
// mutated in place). Used for the sets of games and regions in a filter query.
export function toggleInSet<T>(items: Set<T>, item: T): Set<T> {
  const next = new Set(items);
  if (next.has(item)) {
    next.delete(item);
  } else {
    next.add(item);
  }
  return next;
}