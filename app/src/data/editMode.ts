const EDIT_MODE_KEY = "editMode";

// Edit mode is a tool for tagging which artwork each printing shows. It's remembered in localStorage,
// so it only applies in the browser (and site address) it was turned on in.
// TODO move to the app's settings storage once that exists.

export function isEditModeOn(): boolean {
  try {
    return window.localStorage.getItem(EDIT_MODE_KEY) === "on";
  } catch {
    // Storage can be blocked (e.g. in some private windows). Edit mode is simply off then.
    return false;
  }
}

export function setEditModeOn(on: boolean): void {
  try {
    if (on) {
      window.localStorage.setItem(EDIT_MODE_KEY, "on");
    } else {
      window.localStorage.removeItem(EDIT_MODE_KEY);
    }
  } catch {
    // Storage is blocked, so the setting can't be remembered. Nothing else to do.
  }
}