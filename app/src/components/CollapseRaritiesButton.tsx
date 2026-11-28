import { useState } from "react";
import type { ReactNode } from "react";
import type { EntryGroup } from "../data/entryGroups";
import type { RecordWithFoundPrinting } from "../data/foundPrintings";
import { setEntriesGroups } from "../data/lists";
import type { ListEntryRecord } from "../data/listsDb";
import { planRarityCollapse } from "../data/rarityCollapse";
import type { RarityCollapse } from "../data/rarityCollapse";
import { CollapseRaritiesDialog } from "./CollapseRaritiesDialog";

export function CollapseRaritiesButton({
  listId,
  entries,
  groups,
  changesDisabled,
  onReview,
}: {
  listId: string;
  entries: readonly RecordWithFoundPrinting<ListEntryRecord>[];
  groups: readonly EntryGroup[];
  changesDisabled: boolean;
  onReview: (groupIds: readonly string[]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [collapse, setCollapse] = useState<RarityCollapse | null>(null);

  async function handleClick() {
    const plan = planRarityCollapse(entries, groups);
    if (plan.changes.length === 0) {
      setCollapse(plan);
      return;
    }
    setSaving(true);
    const result = await setEntriesGroups(listId, plan.assignments);
    setSaving(false);
    // Only a change that was saved is reported; after a failure the banner explains.
    if (result.status === "saved") {
      setCollapse(plan);
    }
  }

  let dialog: ReactNode = null;
  if (collapse !== null) {
    dialog = (
      <CollapseRaritiesDialog
        listId={listId}
        collapse={collapse}
        changesDisabled={changesDisabled}
        onReview={onReview}
        onClosed={() => setCollapse(null)}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        className="action-button"
        disabled={changesDisabled || saving}
        title="Group entries that are the same printing, artwork and edition in different rarities"
        onClick={handleClick}
      >
        Collapse rarities
      </button>
      {dialog}
    </>
  );
}