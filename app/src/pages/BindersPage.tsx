import { useState } from "react";
import type { ReactNode } from "react";
import { BinderMeta } from "../components/BinderMeta";
import { GridSizeInput } from "../components/GridSizeInput";
import { NameForm } from "../components/NameForm";
import { SummaryRow } from "../components/SummaryRow";
import {
  canChangeBinders,
  createBinder,
  deleteBinder,
  getBinderCards,
  renameBinder,
  useLiveBinders,
} from "../data/binders";
import { MAX_GRID_SIZE, MIN_GRID_SIZE } from "../data/bindersDb";
import type { BinderCardRecord, BinderRecord } from "../data/bindersDb";

const BACK_LABEL = "binders";

// What the grid boxes of a new binder start with (and go back to after a binder has been created).
const DEFAULT_COLUMNS_TEXT = "3";
const DEFAULT_ROWS_TEXT = "3";

// The grid size a box's text stands for, or null if it isn't a whole number from MIN_GRID_SIZE to MAX_GRID_SIZE
// (which includes it being empty). The boxes only accept digits, so the text is never anything else.
function parseGridSizeText(text: string): number | null {
  if (text === "") {
    return null;
  }
  const size = Number(text);
  return size >= MIN_GRID_SIZE && size <= MAX_GRID_SIZE ? size : null;
}

function BinderSummaryRow({
  binder,
  cards,
  changesDisabled,
}: {
  binder: BinderRecord;
  cards: readonly BinderCardRecord[];
  changesDisabled: boolean;
}) {
  return (
    <SummaryRow
      noun="binder"
      name={binder.name}
      meta={<BinderMeta binder={binder} cards={cards} />}
      openTo={`/binders/${binder.id}`}
      backLabel={BACK_LABEL}
      editable={true}
      changesDisabled={changesDisabled}
      deleteConsequence="Its layout is lost, but your lists are not affected."
      renameRecord={(name) => renameBinder(binder.id, name)}
      deleteRecord={() => deleteBinder(binder.id)}
    />
  );
}

function NewBinderForm({ disabled }: { disabled: boolean }) {
  const [columnsText, setColumnsText] = useState(DEFAULT_COLUMNS_TEXT);
  const [rowsText, setRowsText] = useState(DEFAULT_ROWS_TEXT);

  const columns = parseGridSizeText(columnsText);
  const rows = parseGridSizeText(rowsText);
  const gridIsInvalid = columns === null || rows === null;

  async function save(name: string) {
    // The create button is disabled while the grid is invalid, so this is a mistake in this component, not a user error.
    if (columns === null || rows === null) {
      throw new Error("Tried to create a binder while its grid size is invalid");
    }
    return createBinder(name, columns, rows);
  }

  function resetGrid() {
    setColumnsText(DEFAULT_COLUMNS_TEXT);
    setRowsText(DEFAULT_ROWS_TEXT);
  }

  let gridProblem: ReactNode = null;
  if (gridIsInvalid) {
    gridProblem = (
      <p className="form-error" role="alert">
        {`Columns and rows must each be a number from ${MIN_GRID_SIZE} to ${MAX_GRID_SIZE}.`}
      </p>
    );
  }

  return (
    <>
      <NameForm
        noun="binder"
        initialName=""
        label="New binder name"
        submitText="Create binder"
        disabled={disabled || gridIsInvalid}
        save={save}
        extraFields={
          <div className="grid-size-fields">
            <GridSizeInput
              label="Columns"
              text={columnsText}
              onTextChange={setColumnsText}
              invalid={columns === null}
            />
            <GridSizeInput label="Rows" text={rowsText} onTextChange={setRowsText} invalid={rows === null} />
          </div>
        }
        onSaved={resetGrid}
      />
      {gridProblem}
    </>
  );
}

export function BindersPage() {
  const bindersState = useLiveBinders();
  const changesDisabled = !canChangeBinders(bindersState);

  let content: ReactNode;
  if (bindersState.status === "loading") {
    content = <p className="muted">Loading binders…</p>;
  } else if (bindersState.activeBinders.length === 0) {
    // Unlike lists there are no built-in binders, so this is also what a new user sees (after a failed load the
    // banner says why).
    content = <p className="muted">No binders to show.</p>;
  } else {
    content = (
      <ul className="row-list">
        {bindersState.activeBinders.map((binder) => (
          <li key={binder.id}>
            <BinderSummaryRow
              binder={binder}
              cards={getBinderCards(bindersState, binder.id)}
              changesDisabled={changesDisabled}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <h1>Binders</h1>
      <NewBinderForm disabled={changesDisabled} />
      {content}
    </>
  );
}