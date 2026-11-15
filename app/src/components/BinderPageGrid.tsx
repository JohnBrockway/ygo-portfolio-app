// One page of a binder: a grid of slots. Slots are numbered from 1, row by row (slotIndex in the data counts from 0).
export function BinderPageGrid({
  columns,
  rows,
  pageNumber,
}: {
  columns: number;
  rows: number;
  pageNumber: number;
}) {
  const slotIndexes = Array.from({ length: columns * rows }, (_, slotIndex) => slotIndex);

  return (
    <ol
      className="binder-page"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-label={`Page ${pageNumber}`}
    >
      {slotIndexes.map((slotIndex) => (
        <li key={slotIndex} className="binder-slot" aria-label={`Slot ${slotIndex + 1}, empty`}>
          {slotIndex + 1}
        </li>
      ))}
    </ol>
  );
}