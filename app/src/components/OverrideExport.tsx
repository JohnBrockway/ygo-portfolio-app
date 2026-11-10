import { useEffect, useMemo, useState } from "react";
import { loadMasterData } from "../data/masterData";
import { updateDrafts, useDrafts } from "../data/overrideDrafts";
import { buildOverrides, dropRedundantDrafts, formatOverrideFile } from "../data/overrideExport";
import type { MasterData } from "../data/types";

const EXPORT_FILE_NAME = "printing_overrides.json";

function downloadTextFile(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// Edit mode's export: writes the master data's overrides plus the drafts to a new printing_overrides.json.
export function OverrideExport() {
  const [data, setData] = useState<MasterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drafts = useDrafts();

  useEffect(() => {
    // Ignore the result if the page was left before the fetch finished.
    let cancelled = false;

    loadMasterData()
      .then((loadedData) => {
        if (!cancelled) {
          // Drafts the data already contains (i.e. after backend is rebuilt with an exported file) aren't needed any more.
          updateDrafts((current) => dropRedundantDrafts(loadedData, current));
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

  const build = useMemo(() => (data === null ? null : buildOverrides(data, drafts)), [data, drafts]);

  if (error !== null) {
    return <p>Couldn't load the data to export: {error}</p>;
  }
  if (build === null) {
    return <p className="muted">Loading the data to export…</p>;
  }

  const draftCount = Object.keys(drafts).length;
  const canExport = build.problems.length === 0 && build.entries.length > 0;

  function handleExport() {
    if (build !== null) {
      downloadTextFile(EXPORT_FILE_NAME, formatOverrideFile(build.entries));
    }
  }

  function handleClearDrafts() {
    if (!window.confirm("Discard all drafts? This can't be undone.")) {
      return;
    }
    updateDrafts(() => ({}));
  }

  return (
    <>
      <h3>Export overrides</h3>
      <p>
        Overrides: {build.entries.length} ({build.fromData} already in the data, {build.fromDrafts} from drafts).
        Drafts: {draftCount}.
      </p>
      {build.problems.length > 0 ? (
        <>
          <p>Fix these before exporting:</p>
          <ul>
            {build.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </>
      ) : null}
      {build.warnings.length > 0 ? (
        <ul className="muted">
          {build.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <p>
        <button type="button" className="action-button" disabled={!canExport} onClick={handleExport}>
          Export {EXPORT_FILE_NAME}
        </button>{" "}
        {draftCount > 0 ? (
          <button type="button" className="action-button" onClick={handleClearDrafts}>
            Clear drafts
          </button>
        ) : null}
      </p>
      <p className="muted">
        Replace {EXPORT_FILE_NAME} with the downloaded file in the build pipeine, then run. Check failures.jsonl for
        override_ lines first: an entry the build rejected isn't in the data, so it isn't in this file either.
      </p>
    </>
  );
}