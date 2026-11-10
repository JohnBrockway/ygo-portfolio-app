import { useState } from "react";
import { OverrideExport } from "../components/OverrideExport";
import { isEditModeOn, setEditModeOn } from "../data/editMode";

export function SettingsPage() {
  // Reads the saved setting once, when the page first renders.
  const [editMode, setEditMode] = useState<boolean>(() => isEditModeOn());

  function handleEditModeChange(on: boolean) {
    setEditModeOn(on);
    setEditMode(on);
  }

  return (
    <>
      <h1>Settings</h1>
      <p className="muted">Account and data options will go here.</p>
      <section>
        <h2>Edit mode</h2>
        <p className="muted">Lets you tag which artwork each printing shows. Only needed when adding printing data.</p>
        <label>
          <input
            type="checkbox"
            checked={editMode}
            onChange={(event) => handleEditModeChange(event.target.checked)}
          />{" "}
          Turn on edit mode
        </label>
        {editMode ? <OverrideExport /> : null}
      </section>
    </>
  );
}