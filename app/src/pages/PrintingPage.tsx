import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { EditionCells } from "../components/EditionCells";
import { LinkWithReturnInfo } from "../components/LinkWithReturnInfo";
import { PrintingArt } from "../components/PrintingArt";
import { PrintingEditor } from "../components/PrintingEditor";
import { isEditModeOn } from "../data/editMode";
import { getAvailableImages } from "../data/images";
import { loadMasterData } from "../data/masterData";
import { draftKey, updateDrafts, useDrafts, withDraft, withoutDraft } from "../data/overrideDrafts";
import type { OverrideDraft } from "../data/overrideDrafts";
import { getPrintingRows } from "../data/printingRows";
import type { PendingVersion } from "../data/printingRows";
import { printingName } from "../data/printings";
import type { DisplayPrinting } from "../data/printings";
import type { Edition, MasterData } from "../data/types";

function PrintingDetail({ data, setcodeId }: { data: MasterData; setcodeId: string | undefined }) {
    // Edit mode's changes that haven't been exported yet. They only show while edit mode is on.
  const drafts = useDrafts();
  // Versions just added that are waiting for an artwork. Not saved anywhere, so leaving the page drops them.
  const [pendingVersions, setPendingVersions] = useState<PendingVersion[]>([]);

  const setcode = data.setcodes.find((candidate) => candidate.setcode_id === setcodeId);
  if (setcode === undefined) {
    return (
      <>
        <h1>Printing not found</h1>
        <p className="muted">No printing matching this code.</p>
      </>
    );
  }

  // Either record can be missing in the data; fall back to ids instead of breaking the page.
  const card = data.cards.find((candidate) => candidate.card_id === setcode.card_id);
  const set = data.sets.find((candidate) => candidate.set_id === setcode.set_id);
  const cardTitle = card === undefined ? setcode.card_id : card.title;
  const setTitle = set === undefined ? setcode.set_id : set.title;
  const editions: Edition[] = set === undefined ? [] : set.editions;
  const editMode = isEditModeOn();
  let returnLabel;
  if (setcode.set_number_synthetic) {
    returnLabel = card === undefined ? "printing" : card.title;
  } else {
    returnLabel = setcode.set_number;
  }

  // Each printing as it is shown (in edit mode, with its draft applied, added versions included).
  const rows = getPrintingRows(setcode.printings, setcode.setcode_id, drafts, pendingVersions, editMode);
  const printings = rows.map((row) => row.printing);

    const handleDraftChange = (printing: DisplayPrinting, draft: OverrideDraft | null) => {
    const key = draftKey(setcode.setcode_id, printing.rarity, printing.variant);
    updateDrafts((current) => (draft === null ? withoutDraft(current, key) : withDraft(current, key, draft)));

    // A pending version stops being pending once it has an artwork (so a draft), or is cancelled.
    setPendingVersions(
      pendingVersions.filter((pending) => pending.rarity !== printing.rarity || pending.variant !== printing.variant),
    );
  };

  const handleAddVersion = (rarity: string) => {
    const variants = printings.filter((other) => other.rarity === rarity).map((other) => other.variant);
    setPendingVersions([...pendingVersions, { rarity, variant: Math.max(...variants) + 1 }]);
  };

  // Edit mode's panels hold the artwork picker, so they get wider columns.
  let gridClass = "panel-grid";
  if (editMode) {
    gridClass = "panel-grid panel-grid-edit";
  }

  return (
    <>
      <h1>
        {card === undefined ? (
          cardTitle
        ) : (
          <LinkWithReturnInfo to={`/cards/${card.card_id}`} backLabel={returnLabel}>
            {cardTitle}
          </LinkWithReturnInfo>
        )}
      </h1>
      <p>
        {set === undefined ? (
          setTitle
        ) : (
          <LinkWithReturnInfo to={`/sets/${set.set_id}`} backLabel={returnLabel}>
            {setTitle}
          </LinkWithReturnInfo>
        )}
      </p>
      <div className="row-meta">
        {set === undefined ? null : <span className="tag">{set.region}</span>}
        {setcode.set_number_synthetic ? null : <span>{setcode.set_number}</span>}
        {editMode ? <span className="tag">Edit mode</span> : null}
      </div>
      <div className={gridClass}>
        {rows.map(({ printing, draftKind }, index) => {
          let statusTag: ReactNode = null;
          if (draftKind === "added" || draftKind === "pending") {
            statusTag = <span className="tag">New version</span>;
          } else if (draftKind === "changed") {
            statusTag = <span className="tag">Draft</span>;
          } else if (printing.verified) {
            statusTag = <span className="tag">Verified</span>;
          }

          let art: ReactNode = null;
          if (card !== undefined && editMode) {
            art = (
              <PrintingEditor
                card={card}
                setcodeId={setcode.setcode_id}
                printing={printing}
                draftKind={draftKind}
                onDraftChange={(draft) => handleDraftChange(printing, draft)}
              />
            );
          } else if (card !== undefined) {
            art = <PrintingArt card={card} printing={printing} />;
          }

          // After the last printing of each rarity, edit mode offers to add another version of it
          // (one at a time: not while a version of that rarity is still waiting for its artwork).
          const nextRow = rows[index + 1];
          const isLastOfRarity = nextRow === undefined || nextRow.printing.rarity !== printing.rarity;
          const hasPendingOfRarity = rows.some(
            (row) => row.draftKind === "pending" && row.printing.rarity === printing.rarity,
          );
          let addVersion: ReactNode = null;
          if (
            card !== undefined &&
            editMode &&
            isLastOfRarity &&
            !hasPendingOfRarity &&
            getAvailableImages(card).length > 0
          ) {
            addVersion = (
              <button type="button" className="panel panel-add" onClick={() => handleAddVersion(printing.rarity)}>
                Add another {printing.rarity} version
              </button>
            );
          }

          // Only printings the build has given an id can be marked. Versions that only exist as drafts can't.
          const editionCells =
            printing.printing_id === null ? (
              <p className="muted">Can't be marked until it has been exported and built into the data.</p>
            ) : (
              <EditionCells editions={editions} printingId={printing.printing_id} />
            );

          return (
            <Fragment key={draftKey(setcode.setcode_id, printing.rarity, printing.variant)}>
              <section className="panel">
                <h2 className="panel-title">{printingName(printing, printings)}</h2>
                {statusTag === null ? null : <div className="row-meta">{statusTag}</div>}
                {art}
                <div className="panel-editions">{editionCells}</div>
              </section>
              {addVersion}
            </Fragment>
          );
        })}
      </div>
    </>
  );
}

export function PrintingPage() {
  const { setcodeId } = useParams();
  const [data, setData] = useState<MasterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore the result if the page was left before the fetch finished.
    let cancelled = false;

    loadMasterData()
      .then((loadedData) => {
        if (!cancelled) {
          setData(loadedData);
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
    content = <p>Couldn't load printing: {error}</p>;
  } else if (data === null) {
    content = <p className="muted">Loading printing…</p>;
  } else {
    // key makes this unique per printing page, otherwise React would reuse the component (and its pending
    // versions) if navigating directly between printing pages.
    content = <PrintingDetail key={setcodeId} data={data} setcodeId={setcodeId} />;
  }

  return (
    <>
      <p>
        <BackLink fallbackTo="/cards" fallbackLabel="Cards" />
      </p>
      {content}
    </>
  );
}